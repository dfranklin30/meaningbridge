import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, journalEntriesTable, journalPromptsTable } from "@workspace/db";
import {
  CreateJournalEntryBody,
  GetJournalEntryParams,
  UpdateJournalEntryBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

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
  const [row] = await db
    .insert(journalEntriesTable)
    .values({ ...body, userId: req.userId! })
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
  const [row] = await db
    .update(journalEntriesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  await db
    .delete(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)));
  res.status(204).end();
});

export default router;
