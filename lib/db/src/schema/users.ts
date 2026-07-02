import { pgTable, serial, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Application users. Identity is owned by Clerk; this row is the local
 * mirror keyed by the Clerk user id, created just-in-time on first
 * authenticated request.
 *
 * `role` is null until the person chooses one after sign-up:
 *   - "seeker"       — someone seeking grief support (the full companion app)
 *   - "professional" — a therapist / counselor / grief specialist (caregiver portal)
 */
export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),
    firstName: text("first_name"),
    role: text("role"), // null | "seeker" | "professional"
    // Platform administrator, orthogonal to `role`. Admins verify providers and
    // access the audit/PHI oversight surfaces. Never self-service; set out of band.
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    clerkUserIdUnique: uniqueIndex("users_clerk_user_id_unique").on(t.clerkUserId),
  }),
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
