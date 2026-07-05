import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  communityIdentitiesTable,
  communityRoomsTable,
  communityMembersTable,
  communityMessagesTable,
  communityReportsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { parseId } from "../lib/professionalViews";
import {
  onlineCountForRoom,
  onlineScreenNames,
  broadcastMessageRemoved,
} from "../lib/communityRealtime";
import { suggestCommunityRoom } from "../lib/companionContext";

/**
 * REST surface for community chat. Real-time messaging happens over Socket.IO;
 * these endpoints handle the durable, non-streaming pieces: the screen-name
 * identity, room listing/join/leave, and the safety machinery (reporting a
 * message, and the moderator review view gated to professionals).
 */

const router: IRouter = Router();
router.use(requireAuth);

const SCREEN_NAME_RE = /^[A-Za-z0-9 _-]{3,24}$/;

// --- identity --------------------------------------------------------------

router.get("/identity", async (req, res) => {
  const [row] = await db
    .select({ screenName: communityIdentitiesTable.screenName })
    .from(communityIdentitiesTable)
    .where(eq(communityIdentitiesTable.userId, req.userId!))
    .limit(1);
  res.json({ screenName: row?.screenName ?? null });
});

router.post("/identity", async (req, res) => {
  const raw = typeof req.body?.screenName === "string" ? req.body.screenName.trim() : "";
  if (!SCREEN_NAME_RE.test(raw)) {
    res.status(400).json({
      error: "Please choose a name of 3 to 24 letters, numbers, spaces, hyphens, or underscores.",
    });
    return;
  }
  try {
    const [existing] = await db
      .select({ id: communityIdentitiesTable.id })
      .from(communityIdentitiesTable)
      .where(eq(communityIdentitiesTable.userId, req.userId!))
      .limit(1);
    if (existing) {
      await db
        .update(communityIdentitiesTable)
        .set({ screenName: raw })
        .where(eq(communityIdentitiesTable.userId, req.userId!));
    } else {
      await db
        .insert(communityIdentitiesTable)
        .values({ userId: req.userId!, screenName: raw });
    }
    res.json({ screenName: raw });
  } catch {
    // Unique index violation on screen_name.
    res.status(409).json({ error: "That name is already taken. Please choose another." });
  }
});

// --- rooms -----------------------------------------------------------------

router.get("/rooms", async (req, res) => {
  const rooms = await db
    .select()
    .from(communityRoomsTable)
    .orderBy(communityRoomsTable.sortOrder, communityRoomsTable.name);

  const counts = await db
    .select({
      roomId: communityMembersTable.roomId,
      members: sql<number>`count(*)::int`,
    })
    .from(communityMembersTable)
    .groupBy(communityMembersTable.roomId);
  const memberCount = new Map(counts.map((c) => [c.roomId, c.members]));

  const myMemberships = await db
    .select({ roomId: communityMembersTable.roomId })
    .from(communityMembersTable)
    .where(eq(communityMembersTable.userId, req.userId!));
  const joined = new Set(myMemberships.map((m) => m.roomId));

  const [identity] = await db
    .select({ screenName: communityIdentitiesTable.screenName })
    .from(communityIdentitiesTable)
    .where(eq(communityIdentitiesTable.userId, req.userId!))
    .limit(1);

  res.json({
    screenName: identity?.screenName ?? null,
    rooms: rooms.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      memberCount: memberCount.get(r.id) ?? 0,
      onlineCount: onlineCountForRoom(r.slug),
      online: onlineScreenNames(r.slug),
      joined: joined.has(r.id),
    })),
  });
});

router.post("/rooms/:slug/join", async (req, res) => {
  const slug = req.params.slug;
  const [room] = await db
    .select({ id: communityRoomsTable.id })
    .from(communityRoomsTable)
    .where(eq(communityRoomsTable.slug, slug))
    .limit(1);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  await db
    .insert(communityMembersTable)
    .values({ roomId: room.id, userId: req.userId! })
    .onConflictDoNothing();
  res.json({ ok: true });
});

router.post("/rooms/:slug/leave", async (req, res) => {
  const slug = req.params.slug;
  const [room] = await db
    .select({ id: communityRoomsTable.id })
    .from(communityRoomsTable)
    .where(eq(communityRoomsTable.slug, slug))
    .limit(1);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  await db
    .delete(communityMembersTable)
    .where(
      and(
        eq(communityMembersTable.roomId, room.id),
        eq(communityMembersTable.userId, req.userId!),
      ),
    );
  res.json({ ok: true });
});

// --- suggestion (companion) ------------------------------------------------

router.get("/suggested-room", async (req, res) => {
  const suggestion = await suggestCommunityRoom(req.userId!);
  if (!suggestion) {
    res.json({ suggestion: null });
    return;
  }
  const [room] = await db
    .select({ name: communityRoomsTable.name })
    .from(communityRoomsTable)
    .where(eq(communityRoomsTable.slug, suggestion.slug))
    .limit(1);
  if (!room) {
    res.json({ suggestion: null });
    return;
  }
  res.json({ suggestion: { slug: suggestion.slug, name: room.name, reason: suggestion.reason } });
});

// --- reporting -------------------------------------------------------------

router.post("/messages/:id/report", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid message id" });
    return;
  }
  const [message] = await db
    .select({ id: communityMessagesTable.id })
    .from(communityMessagesTable)
    .where(eq(communityMessagesTable.id, id))
    .limit(1);
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
  await db.insert(communityReportsTable).values({
    messageId: id,
    reporterUserId: req.userId!,
    reason,
  });
  res.json({ ok: true });
});

// --- moderator view (professionals only) -----------------------------------

router.get("/moderation/reports", async (req, res) => {
  if (!req.appUser?.isProfessional) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  const reports = await db
    .select({
      id: communityReportsTable.id,
      reason: communityReportsTable.reason,
      status: communityReportsTable.status,
      createdAt: communityReportsTable.createdAt,
      messageId: communityMessagesTable.id,
      body: communityMessagesTable.body,
      screenName: communityMessagesTable.screenName,
      blocked: communityMessagesTable.blocked,
      removed: communityMessagesTable.removed,
      roomSlug: communityRoomsTable.slug,
      roomName: communityRoomsTable.name,
    })
    .from(communityReportsTable)
    .innerJoin(
      communityMessagesTable,
      eq(communityReportsTable.messageId, communityMessagesTable.id),
    )
    .innerJoin(
      communityRoomsTable,
      eq(communityMessagesTable.roomId, communityRoomsTable.id),
    )
    .where(eq(communityReportsTable.status, "open"))
    .orderBy(desc(communityReportsTable.createdAt))
    .limit(200);
  res.json({ reports });
});

router.post("/moderation/messages/:id/remove", async (req, res) => {
  if (!req.appUser?.isProfessional) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid message id" });
    return;
  }
  const [message] = await db
    .update(communityMessagesTable)
    .set({ removed: true })
    .where(eq(communityMessagesTable.id, id))
    .returning({ id: communityMessagesTable.id, roomId: communityMessagesTable.roomId });
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  const [room] = await db
    .select({ slug: communityRoomsTable.slug })
    .from(communityRoomsTable)
    .where(eq(communityRoomsTable.id, message.roomId))
    .limit(1);
  await db
    .update(communityReportsTable)
    .set({ status: "reviewed" })
    .where(eq(communityReportsTable.messageId, id));
  if (room) broadcastMessageRemoved(room.slug, id);
  res.json({ ok: true });
});

router.post("/moderation/reports/:id/dismiss", async (req, res) => {
  if (!req.appUser?.isProfessional) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  await db
    .update(communityReportsTable)
    .set({ status: "dismissed" })
    .where(eq(communityReportsTable.id, id));
  res.json({ ok: true });
});

export default router;
