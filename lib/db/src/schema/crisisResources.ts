import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const crisisResourcesTable = pgTable("crisis_resources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  description: text("description").notNull(),
  region: text("region").notNull(),
  url: text("url"),
});

export type CrisisResource = typeof crisisResourcesTable.$inferSelect;
