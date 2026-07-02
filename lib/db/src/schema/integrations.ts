import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * A provider's connection to an external EHR / practice-management system.
 *
 * Three kinds:
 *   - "fhir"        — a live SMART-on-FHIR (OAuth 2.0) connection (Epic, athenahealth).
 *   - "csv_preset"  — a saved per-EHR CSV export mapping (SimplePractice, etc.).
 *   - "vendor_api"  — a roadmap partner API shown as "request access".
 *
 * OAuth tokens are PHI-adjacent secrets and are encrypted at rest
 * (`accessTokenEnc` / `refreshTokenEnc`). Disconnecting clears them.
 */
export const integrationConnectionsTable = pgTable(
  "integration_connections",
  {
    id: serial("id").primaryKey(),
    providerUserId: integer("provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // "epic" | "athenahealth" | "valant" | "osmind" | "icanotes" |
    // "simplepractice" | "therapynotes" | "tebra"
    system: text("system").notNull(),
    // "fhir" | "csv_preset" | "vendor_api"
    kind: text("kind").notNull().default("fhir"),
    // "connected" | "disconnected" | "pending"
    status: text("status").notNull().default("disconnected"),
    scopes: text("scopes"),
    fhirBaseUrl: text("fhir_base_url"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    connectedByUserId: integer("connected_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    providerIdx: index("integration_connections_provider_idx").on(t.providerUserId),
    // One connection row per (provider, system).
    providerSystemUnique: uniqueIndex("integration_connections_provider_system_unique").on(
      t.providerUserId,
      t.system,
    ),
  }),
);

export type IntegrationConnection = typeof integrationConnectionsTable.$inferSelect;
