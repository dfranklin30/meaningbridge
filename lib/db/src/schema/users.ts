import { pgTable, serial, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Application users. Identity is owned by Clerk; this row is the local
 * mirror keyed by the Clerk user id, created just-in-time on first
 * authenticated request.
 *
 * Capabilities are additive: an account may be a seeker, a professional, or
 * BOTH. `isSeeker` / `isProfessional` are the source of truth for what an
 * account can do; `activeSpace` records which portal the person is currently
 * looking at (the header switcher flips it). `role` is kept as a legacy mirror
 * of `activeSpace` for older reads and is null until a capability is chosen.
 */
export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),
    firstName: text("first_name"),
    role: text("role"), // legacy mirror of activeSpace: null | "seeker" | "professional"
    // Non-PHI foreign key to the Healthie user (the HIPAA system of record for
    // clinical data). Storing only the id keeps PHI out of our database. Null
    // until the account is provisioned in Healthie.
    healthieUserId: text("healthie_user_id"),
    // Additive capabilities — an account can hold both at once.
    isSeeker: boolean("is_seeker").notNull().default(false),
    isProfessional: boolean("is_professional").notNull().default(false),
    // Which portal is currently active: null | "seeker" | "professional".
    activeSpace: text("active_space"),
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
