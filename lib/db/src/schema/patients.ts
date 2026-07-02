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
 * A patient (referred client) a provider enrolls into MeaningBridge.
 *
 * PHI is encrypted at rest at the application layer: every column suffixed
 * `Enc` holds AES-256-GCM ciphertext (see the api-server `phi` helper), never
 * plain text. Non-PHI engagement metadata (session counts, last-active) is
 * stored in the clear because it is the "minimum necessary" a provider is ever
 * shown — never conversation content.
 *
 * Access is NOT implied by this row. A provider may see a patient only when a
 * matching row exists in `provider_patient_links`; the owning provider gets one
 * at creation and accepted referrals add more.
 */
export const patientsTable = pgTable(
  "patients",
  {
    id: serial("id").primaryKey(),
    // The provider who created / owns this record (base scoping).
    ownerProviderUserId: integer("owner_provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // If the patient later signs in as a seeker, their user row is linked here.
    linkedUserId: integer("linked_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    // --- PHI (encrypted at rest) ---
    firstNameEnc: text("first_name_enc"),
    lastNameEnc: text("last_name_enc"),
    dobEnc: text("dob_enc"),
    emailEnc: text("email_enc"),
    phoneEnc: text("phone_enc"),
    // --- non-PHI metadata ---
    pronouns: text("pronouns"),
    // "draft" | "invited" | "consented" | "active" | "revoked" | "inactive"
    status: text("status").notNull().default("draft"),
    // SHA-256 hash of the single-use consent-link token. The raw token is
    // emailed to the patient once and never stored; lookups hash-and-compare.
    consentTokenHash: text("consent_token_hash"),
    // The one fictional worked example — rendered only in Demo mode, watermarked.
    isDemoSample: boolean("is_demo_sample").notNull().default(false),
    // Engagement metadata surfaced to the provider (never conversation content).
    sessionCount: integer("session_count").notNull().default(0),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    ownerIdx: index("patients_owner_idx").on(t.ownerProviderUserId),
    linkedIdx: index("patients_linked_idx").on(t.linkedUserId),
    consentTokenHashUnique: uniqueIndex("patients_consent_token_hash_unique").on(t.consentTokenHash),
    statusIdx: index("patients_status_idx").on(t.status),
  }),
);

export type Patient = typeof patientsTable.$inferSelect;

/**
 * Which providers may access which patients. The owning provider is inserted
 * here at creation ("owner"); accepted referrals add "referred" rows. Every
 * patient query is scoped through this table, not the UI.
 */
export const providerPatientLinksTable = pgTable(
  "provider_patient_links",
  {
    id: serial("id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patientsTable.id, { onDelete: "cascade" }),
    providerUserId: integer("provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // "owner" | "referred"
    relationship: text("relationship").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    linkUnique: uniqueIndex("provider_patient_links_unique").on(t.patientId, t.providerUserId),
    providerIdx: index("provider_patient_links_provider_idx").on(t.providerUserId),
    patientIdx: index("provider_patient_links_patient_idx").on(t.patientId),
  }),
);

export type ProviderPatientLink = typeof providerPatientLinksTable.$inferSelect;

/**
 * A multi-step intake form. Drafts may be saved before a patient record exists
 * (patientId null); on submit the patient is created and linked. The full
 * multi-step payload is encrypted as one blob in `dataEnc` so its exact shape
 * can evolve in the intake/consent phase without a migration. `riskFlag` and
 * `safetyPlanConfirmed` are kept as plain booleans so the safety gate and audit
 * can reason about them without decrypting.
 */
export const intakesTable = pgTable(
  "intakes",
  {
    id: serial("id").primaryKey(),
    providerUserId: integer("provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    patientId: integer("patient_id").references(() => patientsTable.id, {
      onDelete: "cascade",
    }),
    // "draft" | "submitted"
    status: text("status").notNull().default("draft"),
    // AES-256-GCM ciphertext of the full intake JSON (identity, loss/clinical
    // context, goals). Never plain text.
    dataEnc: text("data_enc"),
    riskFlag: boolean("risk_flag").notNull().default(false),
    safetyPlanConfirmed: boolean("safety_plan_confirmed").notNull().default(false),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    providerIdx: index("intakes_provider_idx").on(t.providerUserId),
    patientIdx: index("intakes_patient_idx").on(t.patientId),
    statusIdx: index("intakes_status_idx").on(t.status),
  }),
);

export type Intake = typeof intakesTable.$inferSelect;

/**
 * Patient consent records. A patient e-signs a plain-language consent before
 * their account activates; the signed timestamp and originating IP are stored
 * for the audit trail. The typed signature (the patient's name) is PHI and is
 * encrypted. Revocation is recorded here and deactivates the patient.
 */
export const consentsTable = pgTable(
  "consents",
  {
    id: serial("id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patientsTable.id, { onDelete: "cascade" }),
    // "patient_data_use" (default) and any future consent types.
    type: text("type").notNull().default("patient_data_use"),
    documentVersion: text("document_version"),
    signerNameEnc: text("signer_name_enc"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    patientIdx: index("consents_patient_idx").on(t.patientId),
  }),
);

export type Consent = typeof consentsTable.$inferSelect;

/**
 * A record of every bulk patient import (CSV/XLSX upload or EHR-preset import).
 * Captures who ran it, when, and the accepted/rejected counts. `report` holds a
 * per-row summary of rejections; it must not contain PHI beyond what is needed
 * to identify a row to the provider who uploaded it.
 */
export const batchImportsTable = pgTable(
  "batch_imports",
  {
    id: serial("id").primaryKey(),
    providerUserId: integer("provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    filename: text("filename"),
    // "csv" | "xlsx" | "ehr:<system>"
    source: text("source").notNull().default("csv"),
    totalRows: integer("total_rows").notNull().default(0),
    acceptedRows: integer("accepted_rows").notNull().default(0),
    rejectedRows: integer("rejected_rows").notNull().default(0),
    report: jsonb("report").$type<Array<{ row: number; ok: boolean; reason?: string }>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerIdx: index("batch_imports_provider_idx").on(t.providerUserId),
  }),
);

export type BatchImport = typeof batchImportsTable.$inferSelect;

/** Insert schema for a batch import row (server sets provider + counts). */
export const insertBatchImportSchema = createInsertSchema(batchImportsTable).omit({
  id: true,
  providerUserId: true,
  createdAt: true,
});
export type InsertBatchImport = z.infer<typeof insertBatchImportSchema>;
