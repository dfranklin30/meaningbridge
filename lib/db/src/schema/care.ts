import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Link between a professional (clinician) and a seeker (client).
 *
 * This table is the single source of truth for "who may see what about whom."
 * Consent is granular, opt-in (every flag defaults to false), server-enforced,
 * and revocable at any time by the client. Nothing about a client ever reaches
 * a clinician without an ACTIVE relationship AND the matching consent flag.
 */
export const careRelationshipsTable = pgTable(
  "care_relationships",
  {
    id: serial("id").primaryKey(),
    clinicianUserId: integer("clinician_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // Null until a client redeems the invite code and connects.
    clientUserId: integer("client_user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    inviteCode: text("invite_code").notNull(),
    inviteEmail: text("invite_email"),
    inviteNote: text("invite_note"),
    // "pending" | "active" | "revoked" | "declined"
    status: text("status").notNull().default("pending"),
    // Granular, client-controlled consent. Opt-in only.
    consentSummaries: boolean("consent_summaries").notNull().default(false),
    consentSafety: boolean("consent_safety").notNull().default(false),
    consentEngagement: boolean("consent_engagement").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    inviteCodeUnique: uniqueIndex("care_relationships_invite_code_unique").on(t.inviteCode),
    clinicianIdx: index("care_relationships_clinician_idx").on(t.clinicianUserId),
    clientIdx: index("care_relationships_client_idx").on(t.clientUserId),
  }),
);

export const insertCareRelationshipSchema = createInsertSchema(careRelationshipsTable).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
  revokedAt: true,
});
export type CareRelationship = typeof careRelationshipsTable.$inferSelect;
export type InsertCareRelationship = z.infer<typeof insertCareRelationshipSchema>;

/**
 * Append-only audit trail (HIPAA groundwork). Every access to or change of a
 * client's care data by a clinician is recorded here. Rows are never updated
 * or deleted in normal operation.
 */
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    subjectUserId: integer("subject_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    relationshipId: integer("relationship_id"),
    detail: text("detail"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("audit_log_actor_idx").on(t.actorUserId),
    subjectIdx: index("audit_log_subject_idx").on(t.subjectUserId),
  }),
);

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
