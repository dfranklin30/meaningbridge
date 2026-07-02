import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { patientsTable } from "./patients";

/**
 * A referral of a patient from one provider to a colleague inside the network.
 * The attached intake summary is clinical PHI and is encrypted (`summaryEnc`).
 * Accepting a referral grants the recipient a `provider_patient_links` row.
 * Every referral event is recorded in the audit log.
 */
export const referralsTable = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patientsTable.id, { onDelete: "cascade" }),
    fromProviderUserId: integer("from_provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    toProviderUserId: integer("to_provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // "pending" | "accepted" | "declined"
    status: text("status").notNull().default("pending"),
    summaryEnc: text("summary_enc"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    fromIdx: index("referrals_from_idx").on(t.fromProviderUserId),
    toIdx: index("referrals_to_idx").on(t.toProviderUserId),
    patientIdx: index("referrals_patient_idx").on(t.patientId),
  }),
);

export type Referral = typeof referralsTable.$inferSelect;

/**
 * A private message thread scoped to a single referral, so clinical context
 * stays attached to the patient record rather than in general chat. Bodies may
 * contain PHI and are encrypted (`bodyEnc`).
 */
export const referralMessagesTable = pgTable(
  "referral_messages",
  {
    id: serial("id").primaryKey(),
    referralId: integer("referral_id")
      .notNull()
      .references(() => referralsTable.id, { onDelete: "cascade" }),
    senderUserId: integer("sender_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    bodyEnc: text("body_enc").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    referralIdx: index("referral_messages_referral_idx").on(t.referralId),
  }),
);

export type ReferralMessage = typeof referralMessagesTable.$inferSelect;
