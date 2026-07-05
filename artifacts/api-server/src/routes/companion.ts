import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  companionMemoryTable,
  companionTasksTable,
  outreachPreferencesTable,
  type CompanionMemory,
  type CompanionTask,
  type OutreachPreferences,
} from "@workspace/db";
import {
  AddCompanionMemoryBody,
  CreateCompanionTaskBody,
  UpdateCompanionTaskBody,
  UpdateOutreachPreferencesBody,
  StartPhoneVerificationBody,
  ConfirmPhoneVerificationBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { parseId } from "../lib/professionalViews";
import { deliverOutreach } from "../lib/outreachChannel";
import { getOrCreateGreeting } from "../lib/companionGreeting";
import {
  journalPrompt,
  reflectionIntro,
  therapistGuidance,
  photoNote,
} from "../lib/companionContext";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  codeMatches,
  generateCode,
  hashCode,
  maskPhone,
  normalizePhone,
} from "../lib/phoneVerification";

/**
 * The patient-facing companion surface: durable memory the person can review and
 * delete, the gentle practice/ritual tasks the companion offers (or the person
 * keeps), and the proactive-outreach preferences (cadence, quiet hours, pause).
 * All of this is the person's OWN data — scoped to req.userId, theirs to edit.
 */

const router: IRouter = Router();
router.use(requireAuth);

router.get("/greeting", async (req, res) => {
  const greeting = await getOrCreateGreeting(req.userId!);
  res.json({ greeting });
});

// --- contextual companion copy woven into the app's surfaces ----------------

router.get("/journal-prompt", async (req, res) => {
  const prompt = await journalPrompt(req.userId!);
  res.json({ prompt });
});

router.get("/reflection-intro", async (req, res) => {
  const exercise = typeof req.query.exercise === "string" ? req.query.exercise : "reflection";
  const intro = await reflectionIntro(req.userId!, exercise);
  res.json({ intro });
});

router.get("/therapist-guidance", async (req, res) => {
  const guidance = await therapistGuidance(req.userId!);
  res.json({ guidance });
});

router.get("/photo-note", async (req, res) => {
  const note = await photoNote(req.userId!);
  res.json({ note });
});

function toMemory(m: CompanionMemory) {
  return {
    id: m.id,
    content: m.content,
    category: m.category,
    source: m.source,
    createdAt: m.createdAt,
  };
}

function toTask(t: CompanionTask) {
  return {
    id: t.id,
    title: t.title,
    body: t.body,
    practiceSlug: t.practiceSlug,
    status: t.status,
    source: t.source,
    dueAt: t.dueAt,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
  };
}

function toPrefs(p: OutreachPreferences) {
  return {
    checkinsEnabled: p.checkinsEnabled,
    cadenceDays: p.cadenceDays,
    taskRemindersEnabled: p.taskRemindersEnabled,
    quietStartHour: p.quietStartHour,
    quietEndHour: p.quietEndHour,
    timezone: p.timezone,
    channel: p.channel,
    paused: p.paused,
    phone: p.phone,
    phoneVerified: Boolean(p.phoneVerifiedAt),
    pendingPhone: p.pendingPhone,
    lastCheckinAt: p.lastCheckinAt,
  };
}

// --- memory ----------------------------------------------------------------

router.get("/memory", async (req, res) => {
  const rows = await db
    .select()
    .from(companionMemoryTable)
    .where(eq(companionMemoryTable.userId, req.userId!))
    .orderBy(desc(companionMemoryTable.createdAt));
  res.json(rows.map(toMemory));
});

router.post("/memory", async (req, res) => {
  const parsed = AddCompanionMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid memory", details: parsed.error.issues });
    return;
  }
  const [row] = await db
    .insert(companionMemoryTable)
    .values({
      userId: req.userId!,
      content: parsed.data.content.trim(),
      category: parsed.data.category ?? "other",
      source: "user",
    })
    .returning();
  res.status(201).json(toMemory(row!));
});

router.delete("/memory/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .delete(companionMemoryTable)
    .where(and(eq(companionMemoryTable.id, id), eq(companionMemoryTable.userId, req.userId!)));
  res.status(204).end();
});

// --- tasks -----------------------------------------------------------------

router.get("/tasks", async (req, res) => {
  const rows = await db
    .select()
    .from(companionTasksTable)
    .where(eq(companionTasksTable.userId, req.userId!))
    .orderBy(desc(companionTasksTable.createdAt));
  res.json(rows.map(toTask));
});

router.post("/tasks", async (req, res) => {
  const parsed = CreateCompanionTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid task", details: parsed.error.issues });
    return;
  }
  const { title, body, practiceSlug, dueAt, status } = parsed.data;
  const [row] = await db
    .insert(companionTasksTable)
    .values({
      userId: req.userId!,
      title: title.trim(),
      body: body ?? null,
      practiceSlug: practiceSlug ?? null,
      dueAt: dueAt ?? null,
      status: status ?? "active",
      source: "user",
    })
    .returning();
  res.status(201).json(toTask(row!));
});

router.patch("/tasks/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateCompanionTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid task update", details: parsed.error.issues });
    return;
  }
  const patch: Partial<typeof companionTasksTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    patch.completedAt = parsed.data.status === "completed" ? new Date() : null;
  }
  if (parsed.data.dueAt !== undefined) {
    patch.dueAt = parsed.data.dueAt ?? null;
  }
  const [row] = await db
    .update(companionTasksTable)
    .set(patch)
    .where(and(eq(companionTasksTable.id, id), eq(companionTasksTable.userId, req.userId!)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toTask(row));
});

// --- outreach preferences --------------------------------------------------

async function getOrCreatePrefs(userId: number): Promise<OutreachPreferences> {
  const [existing] = await db
    .select()
    .from(outreachPreferencesTable)
    .where(eq(outreachPreferencesTable.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(outreachPreferencesTable)
    .values({ userId })
    .onConflictDoNothing({ target: outreachPreferencesTable.userId })
    .returning();
  if (created) return created;
  const [row] = await db
    .select()
    .from(outreachPreferencesTable)
    .where(eq(outreachPreferencesTable.userId, userId))
    .limit(1);
  return row!;
}

router.get("/outreach", async (req, res) => {
  const prefs = await getOrCreatePrefs(req.userId!);
  res.json(toPrefs(prefs));
});

router.put("/outreach", async (req, res) => {
  const parsed = UpdateOutreachPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid preferences", details: parsed.error.issues });
    return;
  }
  const current = await getOrCreatePrefs(req.userId!);
  // SMS may only be chosen once a number has actually been verified — otherwise
  // the scheduler would have nowhere to send and would silently skip.
  if (parsed.data.channel === "sms" && !current.phoneVerifiedAt) {
    res.status(400).json({ error: "Verify a mobile number before choosing text messages." });
    return;
  }
  const [row] = await db
    .update(outreachPreferencesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(outreachPreferencesTable.userId, req.userId!))
    .returning();
  res.json(toPrefs(row!));
});

// --- phone verification ----------------------------------------------------

router.post("/outreach/phone/start", async (req, res) => {
  const parsed = StartPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "That does not look like a mobile number we can reach." });
    return;
  }
  await getOrCreatePrefs(req.userId!);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db
    .update(outreachPreferencesTable)
    .set({
      pendingPhone: phone,
      verificationCodeHash: hashCode(code),
      verificationExpiresAt: expiresAt,
      verificationAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(outreachPreferencesTable.userId, req.userId!));

  // Fire the SMS; degrade gracefully if SMS is not configured. The response
  // reports whether it was actually sent so the UI can guide the person.
  const result = await deliverOutreach({
    channel: "sms",
    to: phone,
    subject: "",
    text: `Your MeaningBridge verification code is ${code}. It expires in 10 minutes.`,
  });

  res.json({ pendingPhone: phone, sent: result.delivered, expiresAt: expiresAt.toISOString() });
});

router.post("/outreach/phone/verify", async (req, res) => {
  const parsed = ConfirmPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const prefs = await getOrCreatePrefs(req.userId!);
  if (!prefs.pendingPhone || !prefs.verificationCodeHash || !prefs.verificationExpiresAt) {
    res.status(400).json({ error: "No verification in progress. Request a new code." });
    return;
  }
  if (prefs.verificationExpiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "That code has expired. Request a new one." });
    return;
  }
  if (prefs.verificationAttempts >= MAX_ATTEMPTS) {
    res.status(400).json({ error: "Too many attempts. Request a new code." });
    return;
  }
  if (!codeMatches(parsed.data.code, prefs.verificationCodeHash)) {
    await db
      .update(outreachPreferencesTable)
      .set({ verificationAttempts: prefs.verificationAttempts + 1, updatedAt: new Date() })
      .where(eq(outreachPreferencesTable.userId, req.userId!));
    res.status(400).json({ error: "That code does not match. Please try again." });
    return;
  }

  const [row] = await db
    .update(outreachPreferencesTable)
    .set({
      phone: prefs.pendingPhone,
      phoneVerifiedAt: new Date(),
      pendingPhone: null,
      verificationCodeHash: null,
      verificationExpiresAt: null,
      verificationAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(outreachPreferencesTable.userId, req.userId!))
    .returning();
  res.json(toPrefs(row!));
});

router.delete("/outreach/phone", async (req, res) => {
  await getOrCreatePrefs(req.userId!);
  // Forgetting the number reverts delivery to email so nothing is stranded.
  const [row] = await db
    .update(outreachPreferencesTable)
    .set({
      phone: null,
      phoneVerifiedAt: null,
      pendingPhone: null,
      verificationCodeHash: null,
      verificationExpiresAt: null,
      verificationAttempts: 0,
      channel: "email",
      updatedAt: new Date(),
    })
    .where(eq(outreachPreferencesTable.userId, req.userId!))
    .returning();
  res.json(toPrefs(row!));
});

export default router;
