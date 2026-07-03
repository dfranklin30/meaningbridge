import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sandboxFeedbackTable = pgTable("sandbox_feedback", {
  id: serial("id").primaryKey(),
  role: text("role"),
  navigationRating: integer("navigation_rating"),
  aestheticsRating: integer("aesthetics_rating"),
  helpfulnessRating: integer("helpfulness_rating"),
  overallRating: integer("overall_rating"),
  // Extended site-evaluation payload: a flexible map of dimension -> 0-10 score
  // and an optional matching map of dimension -> free-text comment, so the
  // questionnaire can evolve without a migration per question.
  ratings: jsonb("ratings").$type<Record<string, number>>(),
  comments: jsonb("comments").$type<Record<string, string>>(),
  additionalSuggestions: text("additional_suggestions"),
  narrative: text("narrative"),
  name: text("name"),
  roleLabel: text("role_label"),
  consentToShare: boolean("consent_to_share").notNull().default(false),
  source: text("source").notNull().default("sandbox"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSandboxFeedbackSchema = createInsertSchema(
  sandboxFeedbackTable,
).omit({ id: true, createdAt: true });
export type SandboxFeedback = typeof sandboxFeedbackTable.$inferSelect;
export type InsertSandboxFeedback = z.infer<typeof insertSandboxFeedbackSchema>;
