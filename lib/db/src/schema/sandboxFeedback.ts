import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
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
