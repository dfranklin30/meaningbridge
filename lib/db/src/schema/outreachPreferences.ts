import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Per-person controls for proactive outreach from the companion. Everything is
 * opt-in and reversible: the person owns the cadence, the quiet hours, and a
 * single pause switch. `channel` is the seam for future SMS (Twilio) — email is
 * the only implementation today. Nothing is ever sent outside these bounds.
 */
export const outreachPreferencesTable = pgTable(
  "outreach_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // Master switch for gentle email check-ins.
    checkinsEnabled: boolean("checkins_enabled").notNull().default(false),
    // Days between check-ins (e.g. 7 = weekly, 14 = fortnightly).
    cadenceDays: integer("cadence_days").notNull().default(7),
    // Send reminders for active companion tasks that have a due date.
    taskRemindersEnabled: boolean("task_reminders_enabled").notNull().default(true),
    // Local quiet hours [start, end) during which nothing is sent (0-23).
    quietStartHour: integer("quiet_start_hour").notNull().default(21),
    quietEndHour: integer("quiet_end_hour").notNull().default(8),
    // IANA timezone used to interpret quiet hours and cadence.
    timezone: text("timezone").notNull().default("America/New_York"),
    // Delivery channel seam: "email" or "sms". SMS requires a verified phone.
    channel: text("channel").notNull().default("email"),
    // Verified mobile number (E.164) used when channel === "sms". Null until the
    // person confirms a one-time code sent to the number.
    phone: text("phone"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    // In-flight verification: the number awaiting confirmation, a HASHED one-time
    // code (never stored in the clear), its expiry, and an attempt counter to
    // throttle guessing. All cleared on success or when a new code is requested.
    pendingPhone: text("pending_phone"),
    verificationCodeHash: text("verification_code_hash"),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
    verificationAttempts: integer("verification_attempts").notNull().default(0),
    // Temporary "pause everything" switch, independent of the enabled flags.
    paused: boolean("paused").notNull().default(false),
    lastCheckinAt: timestamp("last_checkin_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userUnique: uniqueIndex("outreach_preferences_user_unique").on(t.userId),
  }),
);

export type OutreachPreferences = typeof outreachPreferencesTable.$inferSelect;
