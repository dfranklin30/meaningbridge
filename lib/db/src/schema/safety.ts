import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const safetyEventsTable = pgTable("safety_events", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  severity: text("severity").notNull(),
  note: text("note"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSafetyEventSchema = createInsertSchema(safetyEventsTable).omit({
  id: true,
  createdAt: true,
  acknowledged: true,
});
export type SafetyEvent = typeof safetyEventsTable.$inferSelect;
export type InsertSafetyEvent = z.infer<typeof insertSafetyEventSchema>;
