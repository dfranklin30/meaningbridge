import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
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

const router: IRouter = Router();

async function getOrCreateProfile() {
  const [existing] = await db.select().from(profileTable).orderBy(profileTable.id).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(profileTable).values({}).returning();
  return created;
}

router.get("/profile", async (_req, res) => {
  const profile = await getOrCreateProfile();
  res.json(profile);
});

router.put("/profile", async (req, res) => {
  const body = UpdateProfileBody.parse(req.body);
  const current = await getOrCreateProfile();
  const [updated] = await db
    .update(profileTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(profileTable.id, current.id))
    .returning();
  res.json(updated);
});

router.get("/deceased", async (_req, res) => {
  const rows = await db.select().from(deceasedTable).orderBy(desc(deceasedTable.createdAt));
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

router.post("/deceased", async (req, res) => {
  const body = CreateDeceasedProfileBody.parse(req.body);
  const [row] = await db.insert(deceasedTable).values(normalizeDeceased(body)).returning();
  res.status(201).json(row);
});

router.get("/deceased/:id", async (req, res) => {
  const { id } = GetDeceasedProfileParams.parse(req.params);
  const [row] = await db.select().from(deceasedTable).where(eq(deceasedTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/deceased/:id", async (req, res) => {
  const { id } = GetDeceasedProfileParams.parse(req.params);
  const body = UpdateDeceasedProfileBody.parse(req.body);
  const [row] = await db
    .update(deceasedTable)
    .set({ ...normalizeDeceased(body), updatedAt: new Date() })
    .where(eq(deceasedTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/deceased/:id", async (req, res) => {
  const { id } = GetDeceasedProfileParams.parse(req.params);
  await db.delete(deceasedTable).where(eq(deceasedTable.id, id));
  res.status(204).end();
});

export default router;
