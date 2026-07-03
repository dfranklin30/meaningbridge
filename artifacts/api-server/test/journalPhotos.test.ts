import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import {
  db,
  pool,
  usersTable,
  journalEntriesTable,
  journalPhotosTable,
} from "@workspace/db";

/**
 * Guards the journal photo routes' ownership + storage contract. These routes
 * bridge journal entries and object storage, where a silent regression (a
 * broken ownership check, a cross-user object takeover, or a delete that leaves
 * the blob behind) would be a data-leak, not just a bug. The routes are
 * exercised end-to-end against the real dev database with a stubbed Clerk auth
 * and a stubbed ObjectStorageService, so the assertions are about
 * MeaningBridge's own ownership/claim/delete contract, not GCS.
 */

const authState = vi.hoisted(() => ({ clerkUserId: "" }));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: authState.clerkUserId }),
  clerkClient: { users: { getUser: async () => ({}) } },
}));

// Stub object storage so claim/delete are deterministic and offline. The real
// ObjectAccessDeniedError class is preserved so the route's `instanceof` check
// (which maps a cross-user claim to a 403) still works.
const storage = vi.hoisted(() => ({
  claim: vi.fn(),
  del: vi.fn(),
}));

vi.mock("../src/lib/objectStorage", async () => {
  const actual =
    await vi.importActual<typeof import("../src/lib/objectStorage")>(
      "../src/lib/objectStorage",
    );
  return {
    ...actual,
    // A class (not an arrow fn) so `new ObjectStorageService()` in the route
    // works; the methods point at the hoisted spies whose behaviour each test
    // configures in beforeEach.
    ObjectStorageService: class MockObjectStorageService {
      claimObjectEntity = storage.claim;
      deleteObjectEntity = storage.del;
    },
  };
});

const { ObjectAccessDeniedError } = await import("../src/lib/objectStorage");

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = {
      info() {},
      warn() {},
      error() {},
      debug() {},
    };
    next();
  });
  app.use(express.json());
  return app;
}

describe("journal photo routes (ownership + storage contract)", () => {
  const app = makeApp();
  let ownerId = 0;
  let otherId = 0;
  let ownerEntryId = 0;
  let otherEntryId = 0;

  beforeAll(async () => {
    const [owner] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "seeker" })
      .returning();
    ownerId = owner!.id;
    const [other] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "seeker" })
      .returning();
    otherId = other!.id;

    const [ownerEntry] = await db
      .insert(journalEntriesTable)
      .values({ userId: ownerId, title: "Owner entry", body: "mine", category: "general" })
      .returning();
    ownerEntryId = ownerEntry!.id;
    const [otherEntry] = await db
      .insert(journalEntriesTable)
      .values({ userId: otherId, title: "Other entry", body: "theirs", category: "general" })
      .returning();
    otherEntryId = otherEntry!.id;

    const journalRouter = (await import("../src/routes/journal")).default;
    app.use("/journal", journalRouter);
  });

  afterAll(async () => {
    await db.delete(journalPhotosTable).where(eq(journalPhotosTable.userId, ownerId));
    await db.delete(journalPhotosTable).where(eq(journalPhotosTable.userId, otherId));
    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, ownerId));
    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, otherId));
    await db.delete(usersTable).where(eq(usersTable.id, ownerId));
    await db.delete(usersTable).where(eq(usersTable.id, otherId));
    await pool.end();
  });

  beforeEach(() => {
    storage.claim.mockReset();
    storage.del.mockReset();
    // Default: the claim succeeds and echoes a normalized object path.
    storage.claim.mockImplementation(async (path: string) => path);
    storage.del.mockResolvedValue(undefined);
  });

  it("rejects attaching a photo to an entry the caller does not own (404, no claim)", async () => {
    authState.clerkUserId = (
      await db.select().from(usersTable).where(eq(usersTable.id, ownerId))
    )[0]!.clerkUserId;

    // Owner tries to attach a photo to OTHER user's entry.
    const res = await request(app)
      .post(`/journal/${otherEntryId}/photos`)
      .send({ objectPath: "/objects/should-not-attach" });

    expect(res.status).toBe(404);
    // Ownership is checked before any storage claim happens.
    expect(storage.claim).not.toHaveBeenCalled();

    const rows = await db
      .select()
      .from(journalPhotosTable)
      .where(eq(journalPhotosTable.journalEntryId, otherEntryId));
    expect(rows).toHaveLength(0);
  });

  it("rejects a cross-user object claim with 403 and writes no DB row", async () => {
    authState.clerkUserId = (
      await db.select().from(usersTable).where(eq(usersTable.id, ownerId))
    )[0]!.clerkUserId;

    // The object being claimed is already owned by someone else.
    storage.claim.mockRejectedValueOnce(new ObjectAccessDeniedError());

    const res = await request(app)
      .post(`/journal/${ownerEntryId}/photos`)
      .send({ objectPath: "/objects/owned-by-another" });

    expect(res.status).toBe(403);
    expect(storage.claim).toHaveBeenCalledTimes(1);

    const rows = await db
      .select()
      .from(journalPhotosTable)
      .where(eq(journalPhotosTable.journalEntryId, ownerEntryId));
    expect(rows).toHaveLength(0);
  });

  it("attaches a photo to an owned entry, storing the normalized path", async () => {
    authState.clerkUserId = (
      await db.select().from(usersTable).where(eq(usersTable.id, ownerId))
    )[0]!.clerkUserId;

    storage.claim.mockResolvedValueOnce("/objects/normalized-123");

    const res = await request(app)
      .post(`/journal/${ownerEntryId}/photos`)
      .send({ objectPath: "https://storage.googleapis.com/bucket/raw" });

    expect(res.status).toBe(201);
    expect(res.body.objectPath).toBe("/objects/normalized-123");
    expect(res.body.journalEntryId).toBe(ownerEntryId);

    const rows = await db
      .select()
      .from(journalPhotosTable)
      .where(eq(journalPhotosTable.journalEntryId, ownerEntryId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(ownerId);
  });

  it("scopes the photo list to the owning user", async () => {
    // Owner sees their own entry's photos.
    authState.clerkUserId = (
      await db.select().from(usersTable).where(eq(usersTable.id, ownerId))
    )[0]!.clerkUserId;
    const ownerList = await request(app).get(`/journal/${ownerEntryId}/photos`);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.length).toBeGreaterThanOrEqual(1);

    // The OTHER user cannot list the owner's entry photos (404 — indistinguishable
    // from a missing entry, no photo metadata leaks).
    authState.clerkUserId = (
      await db.select().from(usersTable).where(eq(usersTable.id, otherId))
    )[0]!.clerkUserId;
    const otherList = await request(app).get(`/journal/${ownerEntryId}/photos`);
    expect(otherList.status).toBe(404);
  });

  it("deletes both the DB row and the underlying blob, scoped to the owner", async () => {
    authState.clerkUserId = (
      await db.select().from(usersTable).where(eq(usersTable.id, ownerId))
    )[0]!.clerkUserId;

    const [photo] = await db
      .insert(journalPhotosTable)
      .values({
        journalEntryId: ownerEntryId,
        objectPath: "/objects/to-delete",
        userId: ownerId,
      })
      .returning();

    const res = await request(app).delete(`/journal/photos/${photo!.id}`);
    expect(res.status).toBe(204);

    // The blob is removed so a previously-known URL can no longer serve it.
    expect(storage.del).toHaveBeenCalledWith("/objects/to-delete");

    const rows = await db
      .select()
      .from(journalPhotosTable)
      .where(eq(journalPhotosTable.id, photo!.id));
    expect(rows).toHaveLength(0);
  });

  it("does not delete another user's photo row or its blob", async () => {
    // A photo owned by the OTHER user.
    const [photo] = await db
      .insert(journalPhotosTable)
      .values({
        journalEntryId: otherEntryId,
        objectPath: "/objects/other-users-photo",
        userId: otherId,
      })
      .returning();

    // Owner attempts to delete it.
    authState.clerkUserId = (
      await db.select().from(usersTable).where(eq(usersTable.id, ownerId))
    )[0]!.clerkUserId;

    const res = await request(app).delete(`/journal/photos/${photo!.id}`);
    // Route returns 204 either way, but the row must survive and no blob delete fires.
    expect(res.status).toBe(204);
    expect(storage.del).not.toHaveBeenCalled();

    const rows = await db
      .select()
      .from(journalPhotosTable)
      .where(eq(journalPhotosTable.id, photo!.id));
    expect(rows).toHaveLength(1);
  });
});
