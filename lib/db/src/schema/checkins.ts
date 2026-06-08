import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const checkinsTable = pgTable("checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  distress: integer("distress").notNull(),
  meaning: integer("meaning").notNull(),
  connection: integer("connection").notNull(),
  functioning: integer("functioning").notNull(),
  safetyConcern: boolean("safety_concern").notNull().default(false),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCheckInSchema = createInsertSchema(checkinsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type CheckIn = typeof checkinsTable.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
