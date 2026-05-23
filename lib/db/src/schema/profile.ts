import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profileTable = pgTable("profile", {
  id: serial("id").primaryKey(),
  name: text("name"),
  firstName: text("first_name"),
  supportSystem: text("support_system"),
  workingWithTherapist: boolean("working_with_therapist").notNull().default(false),
  preferredMode: text("preferred_mode"),
  crisisAcknowledged: boolean("crisis_acknowledged").notNull().default(false),
  consentJournal: boolean("consent_journal").notNull().default(true),
  consentContinuingBonds: boolean("consent_continuing_bonds").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  // Care tier from validated GIS screener (Lee & Neimeyer, Death Studies 2022).
  // null = not yet screened; "universal" | "targeted" | "clinical"
  tier: text("tier"),
  gisScore: integer("gis_score"),
  gisCompletedAt: timestamp("gis_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profileTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Profile = typeof profileTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
