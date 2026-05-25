import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notifyOptInsTable = pgTable(
  "notify_opt_ins",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    roleInterest: text("role_interest"),
    source: text("source").notNull().default("qr"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("notify_opt_ins_email_unique").on(t.email),
  }),
);

export const insertNotifyOptInSchema = createInsertSchema(notifyOptInsTable).omit({
  id: true,
  createdAt: true,
});
export type NotifyOptIn = typeof notifyOptInsTable.$inferSelect;
export type InsertNotifyOptIn = z.infer<typeof insertNotifyOptInSchema>;
