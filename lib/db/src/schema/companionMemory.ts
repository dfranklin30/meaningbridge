import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Durable, plain-language facts the MeaningBridge companion remembers about a
 * person across sessions (e.g. "Walks the dog every morning since Sam died",
 * "Finds comfort in her mother's garden"). This is the person's OWN content, so
 * it is theirs to see and delete — the companion surfaces it transparently and
 * never shares it with anyone. Not PHI-encrypted because it lives in the
 * seeker's own account, mirroring journal/chat content storage.
 */
export const companionMemoryTable = pgTable(
  "companion_memory",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // Loose grouping for display: "relationship" | "routine" | "support" |
    // "meaning" | "preference" | "loss" | "other".
    category: text("category").notNull().default("other"),
    // "companion" (auto-remembered) | "user" (added by the person themselves).
    source: text("source").notNull().default("companion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdx: index("companion_memory_user_idx").on(t.userId),
  }),
);

export type CompanionMemory = typeof companionMemoryTable.$inferSelect;
