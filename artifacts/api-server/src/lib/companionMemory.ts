import { desc, eq } from "drizzle-orm";
import { db, companionMemoryTable, type CompanionMemory } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";
import { memoryExtractionPrompt } from "./prompts";

/**
 * Durable companion memory. The companion remembers plain-language facts a
 * person shares (who they grieve, comforting routines, sources of meaning) so
 * conversations feel continuous. This is the person's OWN content, surfaced
 * transparently and theirs to delete.
 */

const MEMORY_CATEGORIES = [
  "relationship",
  "routine",
  "support",
  "meaning",
  "preference",
  "loss",
  "other",
];

export interface MemoryFact {
  content: string;
  category: string;
}

/** All remembered facts for a person, newest first. */
export async function listMemories(userId: number): Promise<CompanionMemory[]> {
  return db
    .select()
    .from(companionMemoryTable)
    .where(eq(companionMemoryTable.userId, userId))
    .orderBy(desc(companionMemoryTable.createdAt));
}

/**
 * A system-prompt-appendable block describing what the companion remembers.
 * Woven into the chat system prompt so the companion can reference these
 * naturally. Returns an empty string when there is nothing remembered yet.
 */
export function memoryBlock(memories: Pick<CompanionMemory, "content">[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.content}`).join("\n");
  return `\n\nWhat you remember about this person from past conversations (details they have shared — weave these in naturally when they are relevant, never recite them as a list, and never treat them as clinical facts):\n${lines}`;
}

/**
 * Extract durable, new facts from one exchange and store them. Fire-and-forget:
 * callers never block a response on this. Dedupes (case-insensitive) against the
 * facts already known so the same detail is not stored twice.
 */
export async function extractAndStoreMemories(input: {
  userId: number;
  userText: string;
  assistantText: string;
  existing: string[];
}): Promise<void> {
  try {
    const existingList = input.existing.length
      ? input.existing.map((e) => `- ${e}`).join("\n")
      : "(none yet)";
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      system: memoryExtractionPrompt(),
      messages: [
        {
          role: "user",
          content: `Already remembered:\n${existingList}\n\nNew exchange:\nPerson: ${input.userText}\nCompanion: ${input.assistantText}\n\nReturn only a JSON array of new, durable facts.`,
        },
      ],
    });
    const text = msg.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const facts = parseFacts(text);
    for (const fact of facts) {
      const content = fact.content.trim();
      if (!content || content.length > 200) continue;
      if (input.existing.some((e) => e.toLowerCase() === content.toLowerCase())) continue;
      const category = MEMORY_CATEGORIES.includes(fact.category) ? fact.category : "other";
      await db.insert(companionMemoryTable).values({
        userId: input.userId,
        content,
        category,
        source: "companion",
      });
      input.existing.push(content);
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "companion memory extraction failed",
    );
  }
}

function parseFacts(text: string): MemoryFact[] {
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is { content: string; category?: unknown } =>
          typeof x === "object" && x !== null && typeof (x as { content?: unknown }).content === "string",
      )
      .map((x) => ({
        content: String(x.content),
        category: typeof x.category === "string" ? x.category : "other",
      }));
  } catch {
    return [];
  }
}
