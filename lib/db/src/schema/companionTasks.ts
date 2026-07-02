import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Gentle, Neimeyer-aligned invitations the companion offers a person — a small
 * practice, a writing prompt, a ritual. Never "homework": the companion may
 * SUGGEST one (status "suggested"); the person chooses to take it up ("active"),
 * mark it done ("completed"), or set it aside ("dismissed"). Optional practiceSlug
 * links to a canonical self-guided practice. dueAt + reminders drive the proactive
 * outreach, but always at the person's chosen cadence and never alarming.
 */
export const companionTasksTable = pgTable(
  "companion_tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    // Optional link to a practices.slug so the app can deep-link to the practice.
    practiceSlug: text("practice_slug"),
    // "suggested" | "active" | "completed" | "dismissed"
    status: text("status").notNull().default("suggested"),
    // "companion" (offered by the agent) | "user" (added by the person)
    source: text("source").notNull().default("companion"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdx: index("companion_tasks_user_idx").on(t.userId),
  }),
);

export type CompanionTask = typeof companionTasksTable.$inferSelect;
