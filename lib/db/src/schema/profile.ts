import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profileTable = pgTable("profile", {
  id: serial("id").primaryKey(),
  name: text("name"),
  supportSystem: text("support_system"),
  workingWithTherapist: boolean("working_with_therapist").notNull().default(false),
  preferredMode: text("preferred_mode"),
  crisisAcknowledged: boolean("crisis_acknowledged").notNull().default(false),
  consentJournal: boolean("consent_journal").notNull().default(true),
  consentContinuingBonds: boolean("consent_continuing_bonds").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
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
