import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Professional (clinician) profile that sits on top of a `users` row.
 *
 * A user with role "professional" gets one provider profile. It carries the
 * real-world credentials collected at onboarding, the admin-controlled
 * verification status (nobody handles patients until "verified"), and the
 * opt-in directory fields for Dr. Neimeyer's colleague network.
 *
 * None of these fields are patient PHI — they describe the clinician, who is
 * the account holder — so they are stored in plain text. Patient PHI lives in
 * the `patients`/`intakes` tables and is encrypted at rest.
 */
export const providersTable = pgTable(
  "providers",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    // MD | DO | PhD | PsyD | LCSW | LMFT | LPC | RN | other
    credential: text("credential"),
    licenseNumber: text("license_number"),
    licenseState: text("license_state"),
    npi: text("npi"), // 10-digit National Provider Identifier
    practiceName: text("practice_name"),
    practiceAddress: text("practice_address"),
    // "pending" | "verified" | "rejected"
    verificationStatus: text("verification_status").notNull().default("pending"),
    verificationNote: text("verification_note"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedByUserId: integer("verified_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    // Opt-in colleague directory ("Dr. Neimeyer's network").
    directoryOptIn: boolean("directory_opt_in").notNull().default(false),
    specialtyTags: jsonb("specialty_tags").$type<string[]>().notNull().default([]),
    statesLicensed: jsonb("states_licensed").$type<string[]>().notNull().default([]),
    telehealth: boolean("telehealth").notNull().default(false),
    acceptingReferrals: boolean("accepting_referrals").notNull().default(false),
    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdUnique: uniqueIndex("providers_user_id_unique").on(t.userId),
    verificationIdx: index("providers_verification_idx").on(t.verificationStatus),
    directoryIdx: index("providers_directory_idx").on(t.directoryOptIn),
  }),
);

export const insertProviderSchema = createInsertSchema(providersTable).omit({
  id: true,
  userId: true,
  // Verification is admin-controlled — never accept it from the provider.
  verificationStatus: true,
  verificationNote: true,
  verifiedAt: true,
  verifiedByUserId: true,
  createdAt: true,
  updatedAt: true,
});
export type Provider = typeof providersTable.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;
