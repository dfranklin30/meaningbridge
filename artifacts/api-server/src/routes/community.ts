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
import { moderate } from "../lib/safety";
import { detectCrisis } from "../lib/crisis";

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
      memberCreated: r.createdByUserId !== null,
      createdBy: r.createdByScreenName,
      mine: r.createdByUserId === req.userId,
    })),
  });
});

// A member opens their own room. Curated rooms are seeded; these are the
// spaces people start for a grief they do not see represented. The public,
// persistent name and description run through the same safety net as messages.
const MIN_ROOM_NAME = 3;
const MAX_ROOM_NAME = 60;
const MAX_ROOM_DESC = 200;
const MAX_ROOMS_PER_USER = 15;
const USER_ROOM_SORT = 1000;

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "room";
}

router.post("/rooms", async (req, res) => {
  const [identity] = await db
    .select({ screenName: communityIdentitiesTable.screenName })
    .from(communityIdentitiesTable)
    .where(eq(communityIdentitiesTable.userId, req.userId!))
    .limit(1);
  if (!identity) {
    res.status(400).json({ error: "Please choose a screen name before starting a room." });
    return;
  }

  const name =
    typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim().replace(/\s+/g, " ").slice(0, MAX_ROOM_DESC)
      : "";

  if (name.length < MIN_ROOM_NAME || name.length > MAX_ROOM_NAME) {
    res.status(400).json({ error: "Please give the room a name of 3 to 60 characters." });
    return;
  }

  // Screen the public, persistent room text just as message bodies are screened.
  const mod = await moderate(`${name}\n${description}`);
  if (detectCrisis(`${name} ${description}`) || mod.selfHarm) {
    res.status(422).json({
      error:
        "It sounds like you may be carrying something very heavy. This could not be created as a room, but support is here for you. You can open crisis support from any screen.",
    });
    return;
  }
  if (mod.flagged) {
    res.status(422).json({
      error:
        "To keep this a gentle space, that room could not be created. Please try different wording.",
    });
    return;
  }

  // A gentle cap so the room list stays a calm, navigable place.
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityRoomsTable)
    .where(eq(communityRoomsTable.createdByUserId, req.userId!));
  if ((countRow?.count ?? 0) >= MAX_ROOMS_PER_USER) {
    res.status(429).json({
      error: "You have started the most rooms allowed for now. Please tend the ones you have.",
    });
    return;
  }

  // Insert with a free slug, appending -2, -3, ... on collision. The unique
  // index is the source of truth: onConflictDoNothing returns no row when the
  // slug was taken between attempts (a concurrent creator), so we simply try the
  // next suffix rather than failing the request on a race.
  const baseSlug = slugify(name);
  let room: typeof communityRoomsTable.$inferSelect | undefined;
  for (let attempt = 1; attempt <= 60; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    [room] = await db
      .insert(communityRoomsTable)
      .values({
        slug,
        name,
        description,
        sortOrder: USER_ROOM_SORT,
        createdByUserId: req.userId!,
        createdByScreenName: identity.screenName,
      })
      .onConflictDoNothing({ target: communityRoomsTable.slug })
      .returning();
    if (room) break;
  }
  if (!room) {
    res
      .status(409)
      .json({ error: "A room with a similar name already exists. Please try another name." });
    return;
  }

  // The creator joins their own room.
  await db
    .insert(communityMembersTable)
    .values({ roomId: room.id, userId: req.userId! })
    .onConflictDoNothing();

  res.status(201).json({
    room: {
      slug: room.slug,
      name: room.name,
      description: room.description,
      memberCount: 1,
      onlineCount: onlineCountForRoom(room.slug),
      online: onlineScreenNames(room.slug),
      joined: true,
      memberCreated: true,
      createdBy: room.createdByScreenName,
      mine: true,
    },
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
