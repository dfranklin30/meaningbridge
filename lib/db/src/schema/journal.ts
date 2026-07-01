import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  promptId: integer("prompt_id"),
  // A gentle one-word mood note the writer may add. Optional.
  mood: text("mood"),
  // "private" (default) | "shared" | "share-later"
  privacyStatus: text("privacy_status").notNull().default("private"),
  // The most recent AI reflection offered for this entry, if any.
  aiReflection: text("ai_reflection"),
  // Safety screening result. 0 = no risk ... 4 = imminent risk. Never shown as a number.
  riskLevel: integer("risk_level").notNull().default(0),
  riskFlags: text("risk_flags").array(),
  sharedWithTherapist: boolean("shared_with_therapist").notNull().default(false),
  clinicianAlertSent: boolean("clinician_alert_sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  id: true,
  userId: true,
  aiReflection: true,
  riskLevel: true,
  riskFlags: true,
  clinicianAlertSent: true,
  createdAt: true,
  updatedAt: true,
});
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
