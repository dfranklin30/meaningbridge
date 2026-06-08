import { pgTable, serial, text, integer, jsonb } from "drizzle-orm/pg-core";

export type BreathPhase = {
  label: string;
  seconds: number;
  scale: number;
};

export const practicesTable = pgTable("practices", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  summary: text("summary").notNull(),
  steps: text("steps").array().notNull(),
  breathPattern: jsonb("breath_pattern").$type<BreathPhase[]>(),
});

export type Practice = typeof practicesTable.$inferSelect;
