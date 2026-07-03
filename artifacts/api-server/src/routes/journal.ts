import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  journalPromptsTable,
  journalPhotosTable,
  profileTable,
  safetyEventsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateJournalEntryBody,
  GetJournalEntryParams,
  UpdateJournalEntryBody,
  ListJournalPhotosParams,
  AddJournalPhotoBody,
  DeleteJournalPhotoParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { scoreRisk } from "../lib/risk";
import { journalReflectionPrompt } from "../lib/prompts";
import { ObjectStorageService, ObjectAccessDeniedError } from "../lib/objectStorage";

const router: IRouter = Router();

router.use(requireAuth);

const objectStorageService = new ObjectStorageService();

/** True when the given journal entry exists and belongs to the user. */
async function ownsEntry(userId: number, entryId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: journalEntriesTable.id })
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, entryId), eq(journalEntriesTable.userId, userId)));
  return Boolean(row);
}

router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, req.userId!))
    .orderBy(desc(journalEntriesTable.createdAt));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const body = CreateJournalEntryBody.parse(req.body);
  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, req.userId!))
    .limit(1);
  const risk = profile?.safetyScreeningConsent
    ? scoreRisk(`${body.title}\n${body.body}`)
    : { level: 0, flags: [] as string[] };
  const [row] = await db
    .insert(journalEntriesTable)
    .values({
      ...body,
      userId: req.userId!,
      riskLevel: risk.level,
      riskFlags: risk.flags,
    })
    .returning();
  res.status(201).json(row);
});

router.get("/prompts", async (_req, res) => {
  const rows = await db.select().from(journalPromptsTable).orderBy(journalPromptsTable.id);
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  const [row] = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  const body = UpdateJournalEntryBody.parse(req.body);
  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, req.userId!))
    .limit(1);
  const risk = profile?.safetyScreeningConsent
    ? scoreRisk(`${body.title}\n${body.body}`)
    : { level: 0, flags: [] as string[] };
  const [row] = await db
    .update(journalEntriesTable)
    .set({ ...body, riskLevel: risk.level, riskFlags: risk.flags, updatedAt: new Date() })
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/:id/reflect", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  const [entry] = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, req.userId!))
    .limit(1);

  const risk = profile?.safetyScreeningConsent
    ? scoreRisk(`${entry.title}\n${entry.body}`)
    : { level: 0, flags: [] as string[] };

  let reflection = "";
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: journalReflectionPrompt({ profile: profile ?? null }, risk.level),
      messages: [
        {
          role: "user",
          content: `Here is my journal entry.\n\nTitle: ${entry.title}\n\n${entry.body}`,
        },
      ],
    });
    reflection = msg.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (err) {
    req.log.error({ err }, "journal reflection error");
    res.status(502).json({ error: "reflection failed" });
    return;
  }

  const alertNeeded =
    risk.level >= 4 && !!profile?.clinicianMonitoringConsent && !entry.clinicianAlertSent;
  if (alertNeeded) {
    await db.insert(safetyEventsTable).values({
      userId: req.userId!,
      source: "journal",
      severity: "critical",
      note: `Serious risk language detected in journal entry ${id}. Care team notified per consent.`,
      journalEntryId: id,
      riskLevel: risk.level,
    });
  }

  await db
    .update(journalEntriesTable)
    .set({
      aiReflection: reflection,
      riskLevel: risk.level,
      riskFlags: risk.flags,
      clinicianAlertSent: entry.clinicianAlertSent || alertNeeded,
    })
    .where(eq(journalEntriesTable.id, id));

  res.json({
    reflection,
    riskAcknowledged: risk.level >= 2,
    showCrisisSupport: risk.level >= 3,
    suggestShare: risk.level >= 2 && !entry.sharedWithTherapist,
  });
});

router.delete("/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  await db
    .delete(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)));
  res.status(204).end();
});

router.get("/:entryId/photos", async (req, res) => {
  const { entryId } = ListJournalPhotosParams.parse(req.params);
  if (!(await ownsEntry(req.userId!, entryId))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const rows = await db
    .select()
    .from(journalPhotosTable)
    .where(
      and(eq(journalPhotosTable.journalEntryId, entryId), eq(journalPhotosTable.userId, req.userId!)),
    )
    .orderBy(desc(journalPhotosTable.createdAt));
  res.json(rows);
});

router.post("/:entryId/photos", async (req, res) => {
  const { entryId } = ListJournalPhotosParams.parse(req.params);
  const body = AddJournalPhotoBody.parse(req.body);
  if (!(await ownsEntry(req.userId!, entryId))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Claim ownership of the uploaded object so only this user can read it.
  // Rejects objects already owned by another user (no cross-user takeover).
  let normalizedPath: string;
  try {
    normalizedPath = await objectStorageService.claimObjectEntity(
      body.objectPath,
      String(req.userId!),
    );
  } catch (error) {
    if (error instanceof ObjectAccessDeniedError) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.log.error({ err: error }, "Error claiming uploaded journal photo");
    res.status(400).json({ error: "Could not attach photo" });
    return;
  }

  const [row] = await db
    .insert(journalPhotosTable)
    .values({ journalEntryId: entryId, objectPath: normalizedPath, userId: req.userId! })
    .returning();
  res.status(201).json(row);
});

router.delete("/photos/:photoId", async (req, res) => {
  const { photoId } = DeleteJournalPhotoParams.parse(req.params);
  const [row] = await db
    .delete(journalPhotosTable)
    .where(and(eq(journalPhotosTable.id, photoId), eq(journalPhotosTable.userId, req.userId!)))
    .returning();

  // Remove the underlying blob so a previously known URL can no longer serve it.
  if (row) {
    try {
      await objectStorageService.deleteObjectEntity(row.objectPath);
    } catch (error) {
      req.log.error({ err: error }, "Error deleting journal photo blob");
    }
  }
  res.status(204).end();
});

export default router;
