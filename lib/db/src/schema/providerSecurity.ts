import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Second-factor (authenticator-app TOTP) credentials for provider accounts.
 *
 * Identity, password, and email verification are owned by Clerk. The managed
 * Clerk tenant does not offer authenticator-app MFA, so the app layers a TOTP
 * second factor on top of the existing session for provider accounts that
 * handle real PHI — no separate password system is introduced.
 *
 * - `totpSecretEnc` is the base32 TOTP secret, encrypted at rest (reuse the PHI
 *   cipher). It is written at setup and kept once enabled.
 * - `totpEnabledAt` is null until the provider confirms a code (enrollment).
 * - `recoveryCodes` holds SHA-256 hashes of one-time recovery codes; each is
 *   removed from the array when consumed.
 */
export const providerSecurityTable = pgTable(
  "provider_security",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    recoveryCodes: jsonb("recovery_codes").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdUnique: uniqueIndex("provider_security_user_id_unique").on(t.userId),
  }),
);

export type ProviderSecurity = typeof providerSecurityTable.$inferSelect;
