import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const journalPromptsTable = pgTable("journal_prompts", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
});

export type JournalPrompt = typeof journalPromptsTable.$inferSelect;
