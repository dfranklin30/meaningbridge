import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, safetyEventsTable, crisisResourcesTable } from "@workspace/db";
import { CreateSafetyEventBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events", async (_req, res) => {
  const rows = await db.select().from(safetyEventsTable).orderBy(desc(safetyEventsTable.createdAt));
  res.json(rows);
});

router.post("/events", async (req, res) => {
  const body = CreateSafetyEventBody.parse(req.body);
  const [row] = await db.insert(safetyEventsTable).values(body).returning();
  res.status(201).json(row);
});

router.get("/resources", async (_req, res) => {
  const rows = await db.select().from(crisisResourcesTable).orderBy(crisisResourcesTable.id);
  res.json(rows);
});

export default router;
