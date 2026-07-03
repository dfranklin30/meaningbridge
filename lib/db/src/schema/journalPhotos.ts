import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { journalEntriesTable } from "./journal";

export const journalPhotosTable = pgTable("journal_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  journalEntryId: integer("journal_entry_id")
    .notNull()
    .references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJournalPhotoSchema = createInsertSchema(journalPhotosTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type JournalPhoto = typeof journalPhotosTable.$inferSelect;
export type InsertJournalPhoto = z.infer<typeof insertJournalPhotoSchema>;
