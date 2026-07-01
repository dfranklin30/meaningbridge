import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const safetyEventsTable = pgTable("safety_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  severity: text("severity").notNull(),
  note: text("note"),
  // Optional link back to the journal entry that triggered screening, plus the
  // detected risk level (0-4). Null for non-journal sources.
  journalEntryId: integer("journal_entry_id"),
  riskLevel: integer("risk_level"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSafetyEventSchema = createInsertSchema(safetyEventsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  acknowledged: true,
});
export type SafetyEvent = typeof safetyEventsTable.$inferSelect;
export type InsertSafetyEvent = z.infer<typeof insertSafetyEventSchema>;
