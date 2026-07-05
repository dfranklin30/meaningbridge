import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Community chat: warm, screen-name-only support rooms. No real names or emails
 * are ever stored on messages or membership — a person picks a screen name once
 * (community_identities) and only that is shown anywhere in the community.
 *
 * Presence (who is online, typing) is ephemeral and lives in the realtime layer,
 * never in the database. These tables hold only the durable record: the rooms,
 * who has joined which room, the message history, and safety reports.
 */

/** A person's chosen community screen name — one per account, globally unique. */
export const communityIdentitiesTable = pgTable("community_identities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  screenName: text("screen_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => ({
  userUnique: uniqueIndex("community_identities_user_unique").on(t.userId),
  screenNameUnique: uniqueIndex("community_identities_screen_name_unique").on(t.screenName),
}));

/** A support room. Seeded from a fixed set (see scripts/seed-community). */
export const communityRoomsTable = pgTable("community_rooms", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugUnique: uniqueIndex("community_rooms_slug_unique").on(t.slug),
}));

/** Membership: which people have joined which rooms. */
export const communityMembersTable = pgTable("community_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => communityRoomsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  roomUserUnique: uniqueIndex("community_members_room_user_unique").on(t.roomId, t.userId),
  roomIdx: index("community_members_room_idx").on(t.roomId),
}));

/**
 * Message history. `screenName` is snapshotted at write time so history stays
 * stable even if a person later changes their name. `blocked` marks a message
 * that failed the safety check and was never broadcast (kept only for the
 * moderator record; not returned in normal history).
 */
export const communityMessagesTable = pgTable("community_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => communityRoomsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  screenName: text("screen_name").notNull(),
  body: text("body").notNull(),
  blocked: boolean("blocked").notNull().default(false),
  removed: boolean("removed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  roomCreatedIdx: index("community_messages_room_created_idx").on(t.roomId, t.createdAt),
}));

/** A safety report raised against a message. Reviewed in the moderator view. */
export const communityReportsTable = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => communityMessagesTable.id, { onDelete: "cascade" }),
  // Null reporter = an automatic safety flag (e.g. crisis language) raised by the
  // system rather than by another member.
  reporterUserId: integer("reporter_user_id").references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  reason: text("reason").notNull().default(""),
  // "open" | "reviewed" | "dismissed"
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("community_reports_status_idx").on(t.status),
}));

export type CommunityIdentity = typeof communityIdentitiesTable.$inferSelect;
export type CommunityRoom = typeof communityRoomsTable.$inferSelect;
export type CommunityMember = typeof communityMembersTable.$inferSelect;
export type CommunityMessage = typeof communityMessagesTable.$inferSelect;
export type CommunityReport = typeof communityReportsTable.$inferSelect;
