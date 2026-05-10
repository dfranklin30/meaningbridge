import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, journalEntriesTable, journalPromptsTable } from "@workspace/db";
import {
  CreateJournalEntryBody,
  GetJournalEntryParams,
  UpdateJournalEntryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select().from(journalEntriesTable).orderBy(desc(journalEntriesTable.createdAt));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const body = CreateJournalEntryBody.parse(req.body);
  const [row] = await db.insert(journalEntriesTable).values(body).returning();
  res.status(201).json(row);
});

router.get("/prompts", async (_req, res) => {
  const rows = await db.select().from(journalPromptsTable).orderBy(journalPromptsTable.id);
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  const [row] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  const body = UpdateJournalEntryBody.parse(req.body);
  const [row] = await db
    .update(journalEntriesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(journalEntriesTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const { id } = GetJournalEntryParams.parse(req.params);
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  res.status(204).end();
});

export default router;
