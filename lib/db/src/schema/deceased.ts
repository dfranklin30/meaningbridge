import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deceasedTable = pgTable("deceased_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  lossDate: date("loss_date", { mode: "string" }),
  lossType: text("loss_type"),
  personality: text("personality"),
  commonPhrases: text("common_phrases"),
  memories: text("memories"),
  values: text("values"),
  comfortLanguage: text("comfort_language"),
  boundaries: text("boundaries"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDeceasedSchema = createInsertSchema(deceasedTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Deceased = typeof deceasedTable.$inferSelect;
export type InsertDeceased = z.infer<typeof insertDeceasedSchema>;
