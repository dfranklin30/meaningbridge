import { pgTable, serial, integer, text, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Validated clinical screener responses.
 *
 * Sources (public domain, with citation):
 *   - GIS: Lee & Neimeyer (2022), Death Studies, "Grief Impairment Scale."
 *   - GAQ: Lee & Neimeyer (2025), Death Studies, "Grief Attack Questionnaire." (v2 module)
 *   - ISLES: Holland, Currier & Neimeyer (v2 module)
 */
export const screenerResultsTable = pgTable("screener_results", {
  id: serial("id").primaryKey(),
  instrument: text("instrument").notNull(), // "GIS" | "GAQ" | "ISLES"
  itemResponses: jsonb("item_responses").notNull().$type<Record<string, number>>(),
  score: integer("score").notNull(),
  subscaleScores: jsonb("subscale_scores").$type<Record<string, number>>(),
  cutPointFlag: boolean("cut_point_flag").notNull().default(false),
  tierAssigned: text("tier_assigned"), // "universal" | "targeted" | "clinical"
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScreenerResultSchema = createInsertSchema(screenerResultsTable).omit({
  id: true,
  completedAt: true,
});
export type ScreenerResult = typeof screenerResultsTable.$inferSelect;
export type InsertScreenerResult = z.infer<typeof insertScreenerResultSchema>;
