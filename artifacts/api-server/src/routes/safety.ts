import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, safetyEventsTable, crisisResourcesTable } from "@workspace/db";
import { CreateSafetyEventBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/events", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(safetyEventsTable)
    .where(eq(safetyEventsTable.userId, req.userId!))
    .orderBy(desc(safetyEventsTable.createdAt));
  res.json(rows);
});

router.post("/events", requireAuth, async (req, res) => {
  const body = CreateSafetyEventBody.parse(req.body);
  const [row] = await db
    .insert(safetyEventsTable)
    .values({ ...body, userId: req.userId! })
    .returning();
  res.status(201).json(row);
});

// Public — crisis resources are reference data available to everyone.
router.get("/resources", async (_req, res) => {
  const rows = await db.select().from(crisisResourcesTable).orderBy(crisisResourcesTable.id);
  res.json(rows);
});

export default router;
