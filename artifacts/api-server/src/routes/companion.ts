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
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { parseId } from "../lib/professionalViews";

/**
 * The patient-facing companion surface: durable memory the person can review and
 * delete, the gentle practice/ritual tasks the companion offers (or the person
 * keeps), and the proactive-outreach preferences (cadence, quiet hours, pause).
 * All of this is the person's OWN data — scoped to req.userId, theirs to edit.
 */

const router: IRouter = Router();
router.use(requireAuth);

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
  await getOrCreatePrefs(req.userId!);
  const [row] = await db
    .update(outreachPreferencesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(outreachPreferencesTable.userId, req.userId!))
    .returning();
  res.json(toPrefs(row!));
});

export default router;
