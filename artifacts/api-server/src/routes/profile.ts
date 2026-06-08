import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  profileTable,
  deceasedTable,
} from "@workspace/db";
import {
  UpdateProfileBody,
  CreateDeceasedProfileBody,
  GetDeceasedProfileParams,
  UpdateDeceasedProfileBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// requireAuth is applied per-route (not router-level) because this router is
// mounted at the root path; router-level middleware here would leak onto every
// sibling router, including public ones.

async function getOrCreateProfile(userId: number) {
  const [existing] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(profileTable).values({ userId }).returning();
  return created;
}

router.get("/profile", requireAuth, async (req, res) => {
  const profile = await getOrCreateProfile(req.userId!);
  res.json(profile);
});

router.put("/profile", requireAuth, async (req, res) => {
  const body = UpdateProfileBody.parse(req.body);
  const current = await getOrCreateProfile(req.userId!);
  const [updated] = await db
    .update(profileTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(profileTable.id, current.id))
    .returning();
  res.json(updated);
});

router.get("/deceased", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(deceasedTable)
    .where(eq(deceasedTable.userId, req.userId!))
    .orderBy(desc(deceasedTable.createdAt));
  res.json(rows);
});

function normalizeDeceased<T extends { lossDate?: Date | string | null }>(b: T) {
  return {
    ...b,
    lossDate:
      b.lossDate instanceof Date
        ? b.lossDate.toISOString().slice(0, 10)
        : b.lossDate ?? null,
  };
}

router.post("/deceased", requireAuth, async (req, res) => {
  const body = CreateDeceasedProfileBody.parse(req.body);
  const [row] = await db
    .insert(deceasedTable)
    .values({ ...normalizeDeceased(body), userId: req.userId! })
    .returning();
  res.status(201).json(row);
});

router.get("/deceased/:id", requireAuth, async (req, res) => {
  const { id } = GetDeceasedProfileParams.parse(req.params);
  const [row] = await db
    .select()
    .from(deceasedTable)
    .where(and(eq(deceasedTable.id, id), eq(deceasedTable.userId, req.userId!)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/deceased/:id", requireAuth, async (req, res) => {
  const { id } = GetDeceasedProfileParams.parse(req.params);
  const body = UpdateDeceasedProfileBody.parse(req.body);
  const [row] = await db
    .update(deceasedTable)
    .set({ ...normalizeDeceased(body), updatedAt: new Date() })
    .where(and(eq(deceasedTable.id, id), eq(deceasedTable.userId, req.userId!)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/deceased/:id", requireAuth, async (req, res) => {
  const { id } = GetDeceasedProfileParams.parse(req.params);
  await db
    .delete(deceasedTable)
    .where(and(eq(deceasedTable.id, id), eq(deceasedTable.userId, req.userId!)));
  res.status(204).end();
});

export default router;
