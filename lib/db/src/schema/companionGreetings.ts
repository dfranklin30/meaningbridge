import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * A cached, once-per-UTC-day personalized companion greeting for the dashboard.
 * On return, the companion greets the person by name, references something real
 * they have shared (their loved one, a recent journal theme, or how long it has
 * been — warmly, never as guilt) and offers ONE gentle next step. Cached per day
 * so the greeting is steady within a day and the model is not re-run on every
 * load. Derived entirely from the person's own content; theirs, never shared.
 */
export const companionGreetingsTable = pgTable(
  "companion_greetings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // UTC calendar day this greeting was generated for, "YYYY-MM-DD".
    dateKey: text("date_key").notNull(),
    greeting: text("greeting").notNull(),
    suggestionText: text("suggestion_text").notNull(),
    // "journal" | "reflection" | "talk" | "loved_one" | "practice"
    suggestionAction: text("suggestion_action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDayUnique: uniqueIndex("companion_greetings_user_day_unique").on(t.userId, t.dateKey),
  }),
);

export type CompanionGreeting = typeof companionGreetingsTable.$inferSelect;
