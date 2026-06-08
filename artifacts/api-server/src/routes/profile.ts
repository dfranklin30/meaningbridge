import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  profileTable,
  deceasedTable,
  deceasedPhotosTable,
} from "@workspace/db";
import {
  UpdateProfileBody,
  CreateDeceasedProfileBody,
  GetDeceasedProfileParams,
  UpdateDeceasedProfileBody,
  ListDeceasedPhotosParams,
  AddDeceasedPhotoBody,
  DeleteDeceasedPhotoParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { ObjectStorageService, ObjectAccessDeniedError } from "../lib/objectStorage";

const objectStorageService = new ObjectStorageService();

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

async function ownsDeceased(userId: number, deceasedId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: deceasedTable.id })
    .from(deceasedTable)
    .where(and(eq(deceasedTable.id, deceasedId), eq(deceasedTable.userId, userId)));
  return Boolean(row);
}

router.get("/deceased/:id/photos", requireAuth, async (req, res) => {
  const { id } = ListDeceasedPhotosParams.parse(req.params);
  if (!(await ownsDeceased(req.userId!, id))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const rows = await db
    .select()
    .from(deceasedPhotosTable)
    .where(
      and(eq(deceasedPhotosTable.deceasedId, id), eq(deceasedPhotosTable.userId, req.userId!)),
    )
    .orderBy(desc(deceasedPhotosTable.createdAt));
  res.json(rows);
});

router.post("/deceased/:id/photos", requireAuth, async (req, res) => {
  const { id } = ListDeceasedPhotosParams.parse(req.params);
  const body = AddDeceasedPhotoBody.parse(req.body);
  if (!(await ownsDeceased(req.userId!, id))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Claim ownership of the uploaded object so only this user can read it.
  // Rejects objects already owned by another user (no cross-user takeover).
  let normalizedPath: string;
  try {
    normalizedPath = await objectStorageService.claimObjectEntity(
      body.objectPath,
      String(req.userId!),
    );
  } catch (error) {
    if (error instanceof ObjectAccessDeniedError) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.log.error({ err: error }, "Error claiming uploaded object");
    res.status(400).json({ error: "Could not attach photo" });
    return;
  }

  const [row] = await db
    .insert(deceasedPhotosTable)
    .values({ deceasedId: id, objectPath: normalizedPath, userId: req.userId! })
    .returning();
  res.status(201).json(row);
});

router.delete("/deceased/photos/:photoId", requireAuth, async (req, res) => {
  const { photoId } = DeleteDeceasedPhotoParams.parse(req.params);
  const [row] = await db
    .delete(deceasedPhotosTable)
    .where(
      and(eq(deceasedPhotosTable.id, photoId), eq(deceasedPhotosTable.userId, req.userId!)),
    )
    .returning();

  // Remove the underlying blob so a previously known URL can no longer serve it.
  if (row) {
    try {
      await objectStorageService.deleteObjectEntity(row.objectPath);
    } catch (error) {
      req.log.error({ err: error }, "Error deleting object blob");
    }
  }
  res.status(204).end();
});

export default router;
