import { pgTable, serial, text, boolean, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const profileTable = pgTable("profile", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
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
  // Breath pacer preferences, carried across devices. Sound off by default
  // (trauma-informed, never a surprise sound); counter visible by default.
  breathCueEnabled: boolean("breath_cue_enabled").notNull().default(false),
  breathCounterVisible: boolean("breath_counter_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => ({
  userIdUnique: uniqueIndex("profile_user_id_unique").on(t.userId),
}));

export const insertProfileSchema = createInsertSchema(profileTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type Profile = typeof profileTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
