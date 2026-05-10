import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const practicesTable = pgTable("practices", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  summary: text("summary").notNull(),
  steps: text("steps").array().notNull(),
});

export type Practice = typeof practicesTable.$inferSelect;
