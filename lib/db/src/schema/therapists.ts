import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const therapistsTable = pgTable("therapists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  credentials: text("credentials").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  modality: text("modality").notNull(),
  bio: text("bio").notNull(),
  website: text("website"),
});

export type Therapist = typeof therapistsTable.$inferSelect;
