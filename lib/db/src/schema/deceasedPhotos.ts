import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { deceasedTable } from "./deceased";

export const deceasedPhotosTable = pgTable("deceased_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  deceasedId: integer("deceased_id")
    .notNull()
    .references(() => deceasedTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeceasedPhotoSchema = createInsertSchema(deceasedPhotosTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type DeceasedPhoto = typeof deceasedPhotosTable.$inferSelect;
export type InsertDeceasedPhoto = z.infer<typeof insertDeceasedPhotoSchema>;
