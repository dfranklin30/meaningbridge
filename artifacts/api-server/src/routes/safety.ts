import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, safetyEventsTable, crisisResourcesTable } from "@workspace/db";
import { CreateSafetyEventBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// The user's own safety feed must never expose internal codes, screener item
// IDs, risk levels, or scores/totals — the product promise is "you are never
// shown a score". We sanitize on read so both existing and future rows are safe
// regardless of what an internal note happens to contain.
function userFacingSource(source: string): string {
  if (source.startsWith("gis_") || source === "checkin") return "Check-in";
  if (source === "journal") return "Journal";
  return "Companion";
}

function userFacingNote(source: string): string {
  if (source.startsWith("gis_") || source === "checkin") {
    return "Some of your recent answers suggested you might be going through a particularly hard time.";
  }
  if (source === "journal") {
    return "We noticed some painful language in a journal entry.";
  }
  return "We noticed some painful language during a conversation.";
}

router.get("/events", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(safetyEventsTable)
    .where(eq(safetyEventsTable.userId, req.userId!))
    .orderBy(desc(safetyEventsTable.createdAt));
  const safe = rows.map((r) => ({
    ...r,
    source: userFacingSource(r.source),
    note: userFacingNote(r.source),
    riskLevel: null,
  }));
  res.json(safe);
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
