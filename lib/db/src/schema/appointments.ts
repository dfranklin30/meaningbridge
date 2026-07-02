import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { patientsTable } from "./patients";

/**
 * A proposed or confirmed session between a verified provider and a patient in
 * their network. The provider proposes a time; the patient confirms or declines
 * via a tokenized email link (no login required). When the provider has Google
 * Calendar connected, the event is mirrored there (googleEventId/googleCalendarId).
 *
 * Content boundary: `notes` and `location` are PROVIDER-authored logistics
 * (e.g. a video link), never the patient's private grief content. No patient
 * journal/chat text is ever stored here.
 */
export const appointmentsTable = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    providerUserId: integer("provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patientsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("MeaningBridge session"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    // "proposed" | "confirmed" | "declined" | "cancelled"
    status: text("status").notNull().default("proposed"),
    // Provider-authored logistics only (e.g. a video-call link or room).
    location: text("location"),
    notes: text("notes"),
    // SHA-256 hash of the patient's confirm/decline token (raw token only in email).
    confirmTokenHash: text("confirm_token_hash"),
    googleEventId: text("google_event_id"),
    googleCalendarId: text("google_calendar_id"),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    providerIdx: index("appointments_provider_idx").on(t.providerUserId),
    patientIdx: index("appointments_patient_idx").on(t.patientId),
  }),
);

export type Appointment = typeof appointmentsTable.$inferSelect;
