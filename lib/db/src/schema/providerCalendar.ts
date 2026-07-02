import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * A provider's calendar-sync preference. The Google account itself is connected
 * at the Replit-account level (via the Google Calendar integration/connector),
 * so no OAuth tokens are stored here — only which calendar to write to and
 * whether sync is on. When sync is off (or the account is not connected),
 * appointments still work fully via email; the calendar mirror is simply skipped.
 */
export const providerCalendarTable = pgTable(
  "provider_calendar",
  {
    id: serial("id").primaryKey(),
    providerUserId: integer("provider_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("google"),
    calendarId: text("calendar_id").notNull().default("primary"),
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    providerUnique: uniqueIndex("provider_calendar_provider_user_unique").on(t.providerUserId),
  }),
);

export type ProviderCalendar = typeof providerCalendarTable.$inferSelect;
