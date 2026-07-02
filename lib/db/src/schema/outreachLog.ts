import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Idempotency + audit ledger for every proactive message the scheduler sends.
 * The `dedupeKey` (e.g. "checkin:42:2026-07-02", "task_reminder:118",
 * "appointment_reminder:87") is UNIQUE — the scheduler inserts the key first and
 * only sends if the insert wins, so a restart or overlapping tick can never
 * double-message someone.
 */
export const outreachLogTable = pgTable(
  "outreach_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // "checkin" | "task_reminder" | "appointment_invite" | "appointment_reminder"
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    channel: text("channel").notNull().default("email"),
    // "sent" | "failed" | "skipped"
    status: text("status").notNull().default("sent"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dedupeUnique: uniqueIndex("outreach_log_dedupe_unique").on(t.dedupeKey),
    userIdx: index("outreach_log_user_idx").on(t.userId),
  }),
);

export type OutreachLog = typeof outreachLogTable.$inferSelect;
