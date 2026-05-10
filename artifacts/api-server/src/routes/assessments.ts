import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, checkinsTable, safetyEventsTable } from "@workspace/db";
import { CreateCheckInBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/checkins", async (_req, res) => {
  const rows = await db.select().from(checkinsTable).orderBy(desc(checkinsTable.createdAt));
  res.json(rows);
});

router.post("/checkins", async (req, res) => {
  const body = CreateCheckInBody.parse(req.body);
  const [row] = await db.insert(checkinsTable).values(body).returning();
  if (body.safetyConcern) {
    await db.insert(safetyEventsTable).values({
      source: "checkin",
      severity: "warning",
      note: body.note ?? "Safety concern indicated on check-in",
    });
  }
  res.status(201).json(row);
});

export default router;
