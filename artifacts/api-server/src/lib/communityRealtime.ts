import type { Server as HttpServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import cookieParser from "cookie-parser";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  communityIdentitiesTable,
  communityRoomsTable,
  communityMembersTable,
  communityMessagesTable,
  communityReportsTable,
} from "@workspace/db";
import { moderate } from "./safety";
import { detectCrisis } from "./crisis";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { logger } from "./logger";

/**
 * Real-time community chat over Socket.IO. Mounted under the /api service path so
 * the shared reverse proxy routes the WebSocket handshake correctly. Handshake
 * auth reuses the same Clerk cookie session as the REST API (via io.engine.use),
 * so no tokens are passed in the client.
 *
 * Safety is enforced BEFORE any broadcast: every inbound message runs through the
 * crisis regex net and OpenAI moderation. Crisis language is never broadcast —
 * the sender privately receives the 988 resource and a moderator flag is raised.
 * Otherwise-harmful content is blocked with a kind, private explanation.
 *
 * Presence (who is online / typing) is ephemeral and kept only in memory here;
 * only durable rows (membership, message history, reports) touch the database.
 */

const SOCKET_PATH = "/api/socket.io";
const MAX_BODY = 2000;
const MIN_SEND_INTERVAL_MS = 400;

const CRISIS_MESSAGE =
  "It sounds like you are carrying something very heavy right now. You deserve support with this. In the US you can call or text 988 any time to reach the Suicide and Crisis Lifeline. You can also open the crisis support page from any screen. I am glad you are here.";
const BLOCKED_MESSAGE =
  "To keep this a gentle, safe space for everyone, that message was not shared. You are welcome to rephrase and try again.";

function roomKey(slug: string): string {
  return `room:${slug}`;
}

interface RoomPresence {
  // userId -> { screenName, socket ids }
  members: Map<number, { screenName: string; sockets: Set<string> }>;
}
const presence = new Map<string, RoomPresence>();

function presenceFor(slug: string): RoomPresence {
  let p = presence.get(slug);
  if (!p) {
    p = { members: new Map() };
    presence.set(slug, p);
  }
  return p;
}

function onlineScreenNames(slug: string): string[] {
  const p = presence.get(slug);
  if (!p) return [];
  return [...p.members.values()].map((m) => m.screenName).sort((a, b) => a.localeCompare(b));
}

export function onlineCountForRoom(slug: string): number {
  return presence.get(slug)?.members.size ?? 0;
}

let ioRef: IOServer | null = null;

/** Called from the moderator REST route so a removal reaches connected clients. */
export function broadcastMessageRemoved(slug: string, messageId: number): void {
  ioRef?.to(roomKey(slug)).emit("message:removed", { slug, id: messageId });
}

interface SocketData {
  userId: number;
  screenName: string | null;
  lastSendAt: number;
}

type ChatSocket = Socket & { data: SocketData };

async function loadScreenName(userId: number): Promise<string | null> {
  const [row] = await db
    .select({ screenName: communityIdentitiesTable.screenName })
    .from(communityIdentitiesTable)
    .where(eq(communityIdentitiesTable.userId, userId))
    .limit(1);
  return row?.screenName ?? null;
}

async function slugToRoomId(slug: string): Promise<number | null> {
  const [room] = await db
    .select({ id: communityRoomsTable.id })
    .from(communityRoomsTable)
    .where(eq(communityRoomsTable.slug, slug))
    .limit(1);
  return room?.id ?? null;
}

function emitPresence(slug: string): void {
  ioRef?.to(roomKey(slug)).emit("presence", {
    slug,
    online: onlineScreenNames(slug),
    count: onlineCountForRoom(slug),
  });
}

function addPresence(slug: string, socket: ChatSocket): boolean {
  const p = presenceFor(slug);
  const existing = p.members.get(socket.data.userId);
  const firstForUser = !existing;
  if (existing) {
    existing.sockets.add(socket.id);
    existing.screenName = socket.data.screenName ?? existing.screenName;
  } else {
    p.members.set(socket.data.userId, {
      screenName: socket.data.screenName ?? "Someone",
      sockets: new Set([socket.id]),
    });
  }
  return firstForUser;
}

function removePresence(slug: string, socket: ChatSocket): boolean {
  const p = presence.get(slug);
  if (!p) return false;
  const entry = p.members.get(socket.data.userId);
  if (!entry) return false;
  entry.sockets.delete(socket.id);
  if (entry.sockets.size === 0) {
    p.members.delete(socket.data.userId);
    return true; // last socket for this user left the room
  }
  return false;
}

export function initCommunityRealtime(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    cors: { origin: true, credentials: true },
  });
  ioRef = io;

  // Run the same cookie + Clerk middleware on the WebSocket handshake so the
  // socket shares the REST session. getAuth(socket.request) then resolves.
  io.engine.use(cookieParser());
  io.engine.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req as never) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );

  io.use(async (socket, next) => {
    try {
      const auth = getAuth((socket as ChatSocket).request as never);
      const clerkUserId = auth?.userId;
      if (!clerkUserId) {
        next(new Error("unauthorized"));
        return;
      }
      const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.clerkUserId, clerkUserId))
        .limit(1);
      if (!user) {
        next(new Error("unauthorized"));
        return;
      }
      const s = socket as ChatSocket;
      s.data.userId = user.id;
      s.data.screenName = await loadScreenName(user.id);
      s.data.lastSendAt = 0;
      next();
    } catch (err) {
      logger.warn({ err: String(err) }, "community socket auth failed");
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const s = socket as ChatSocket;
    const joined = new Set<string>();

    socket.on("identity:refresh", async () => {
      s.data.screenName = await loadScreenName(s.data.userId);
    });

    socket.on("room:join", async (payload: { slug?: unknown }) => {
      const slug = typeof payload?.slug === "string" ? payload.slug : "";
      if (!slug) return;
      if (!s.data.screenName) {
        socket.emit("error:message", { reason: "Choose a screen name before joining." });
        return;
      }
      const roomId = await slugToRoomId(slug);
      if (!roomId) return;

      await db
        .insert(communityMembersTable)
        .values({ roomId, userId: s.data.userId })
        .onConflictDoNothing();

      socket.join(roomKey(slug));
      joined.add(slug);
      const firstForUser = addPresence(slug, s);

      const history = await db
        .select({
          id: communityMessagesTable.id,
          screenName: communityMessagesTable.screenName,
          body: communityMessagesTable.body,
          createdAt: communityMessagesTable.createdAt,
          userId: communityMessagesTable.userId,
        })
        .from(communityMessagesTable)
        .where(
          and(
            eq(communityMessagesTable.roomId, roomId),
            eq(communityMessagesTable.blocked, false),
            eq(communityMessagesTable.removed, false),
          ),
        )
        .orderBy(desc(communityMessagesTable.createdAt))
        .limit(50);
      socket.emit("history", {
        slug,
        messages: history
          .reverse()
          .map((m) => ({
            id: m.id,
            screenName: m.screenName,
            body: m.body,
            createdAt: m.createdAt,
            mine: m.userId === s.data.userId,
          })),
      });

      if (firstForUser) {
        socket
          .to(roomKey(slug))
          .emit("system", { slug, text: `${s.data.screenName} joined the room` });
      }
      emitPresence(slug);
    });

    socket.on("room:leave", (payload: { slug?: unknown }) => {
      const slug = typeof payload?.slug === "string" ? payload.slug : "";
      if (!slug || !joined.has(slug)) return;
      socket.leave(roomKey(slug));
      joined.delete(slug);
      const lastForUser = removePresence(slug, s);
      if (lastForUser && s.data.screenName) {
        socket
          .to(roomKey(slug))
          .emit("system", { slug, text: `${s.data.screenName} left the room` });
      }
      emitPresence(slug);
    });

    socket.on("typing", (payload: { slug?: unknown; isTyping?: unknown }) => {
      const slug = typeof payload?.slug === "string" ? payload.slug : "";
      if (!slug || !joined.has(slug) || !s.data.screenName) return;
      socket.to(roomKey(slug)).emit("typing", {
        slug,
        screenName: s.data.screenName,
        isTyping: Boolean(payload?.isTyping),
      });
    });

    socket.on("message:send", async (payload: { slug?: unknown; body?: unknown }) => {
      const slug = typeof payload?.slug === "string" ? payload.slug : "";
      const raw = typeof payload?.body === "string" ? payload.body : "";
      const body = raw.trim().slice(0, MAX_BODY);
      if (!slug || !body) return;
      if (!s.data.screenName) {
        socket.emit("error:message", { reason: "Choose a screen name before sending." });
        return;
      }
      if (!joined.has(slug)) return;

      const now = Date.now();
      if (now - s.data.lastSendAt < MIN_SEND_INTERVAL_MS) return;
      s.data.lastSendAt = now;

      const roomId = await slugToRoomId(slug);
      if (!roomId) return;

      // Crisis language: never broadcast. Persist blocked, privately surface 988,
      // and raise an automatic moderator flag.
      const mod = await moderate(body);
      const isCrisis = detectCrisis(body) || mod.selfHarm;
      if (isCrisis) {
        const [msg] = await db
          .insert(communityMessagesTable)
          .values({ roomId, userId: s.data.userId, screenName: s.data.screenName, body, blocked: true })
          .returning({ id: communityMessagesTable.id });
        if (msg) {
          await db
            .insert(communityReportsTable)
            .values({ messageId: msg.id, reason: "auto:crisis-language" });
        }
        socket.emit("crisis", { message: CRISIS_MESSAGE });
        return;
      }

      // Other harmful content: block with a kind private explanation.
      if (mod.flagged) {
        await db
          .insert(communityMessagesTable)
          .values({ roomId, userId: s.data.userId, screenName: s.data.screenName, body, blocked: true });
        socket.emit("message:blocked", { reason: BLOCKED_MESSAGE });
        return;
      }

      const [msg] = await db
        .insert(communityMessagesTable)
        .values({ roomId, userId: s.data.userId, screenName: s.data.screenName, body })
        .returning({ id: communityMessagesTable.id, createdAt: communityMessagesTable.createdAt });
      if (!msg) return;

      const base = { slug, id: msg.id, screenName: s.data.screenName, body, createdAt: msg.createdAt };
      socket.emit("message:new", { ...base, mine: true });
      socket.to(roomKey(slug)).emit("message:new", { ...base, mine: false });
    });

    socket.on("disconnect", () => {
      for (const slug of joined) {
        const lastForUser = removePresence(slug, s);
        if (lastForUser && s.data.screenName) {
          socket
            .to(roomKey(slug))
            .emit("system", { slug, text: `${s.data.screenName} left the room` });
        }
        emitPresence(slug);
      }
      joined.clear();
    });
  });

  logger.info({ path: SOCKET_PATH }, "community realtime initialized");
  return io;
}

/** Read helper for the REST rooms list: distinct online screen names per room. */
export { onlineScreenNames };
