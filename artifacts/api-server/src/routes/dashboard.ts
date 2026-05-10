import { Router, type IRouter } from "express";
import { desc, sql, asc } from "drizzle-orm";
import {
  db,
  checkinsTable,
  journalEntriesTable,
  chatSessionsTable,
  chatMessagesTable,
  practicesTable,
  journalPromptsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/summary", async (_req, res) => {
  const [latestCheckIn] = await db
    .select()
    .from(checkinsTable)
    .orderBy(desc(checkinsTable.createdAt))
    .limit(1);

  const [{ count: checkInCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(checkinsTable);
  const [{ count: journalCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(journalEntriesTable);
  const [{ count: sessionCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(chatSessionsTable);
  const [{ count: crisisFlagCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(chatMessagesTable)
    .where(sql`${chatMessagesTable.crisisFlag} = true`);

  const recentJournal = await db
    .select()
    .from(journalEntriesTable)
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(3);
  const recentSessions = await db
    .select()
    .from(chatSessionsTable)
    .orderBy(desc(chatSessionsTable.createdAt))
    .limit(3);
  const suggestedPractices = await db
    .select()
    .from(practicesTable)
    .orderBy(sql`random()`)
    .limit(3);
  const suggestedPrompts = await db
    .select()
    .from(journalPromptsTable)
    .orderBy(sql`random()`)
    .limit(3);

  res.json({
    latestCheckIn: latestCheckIn ?? null,
    checkInCount,
    journalCount,
    sessionCount,
    recentJournal,
    recentSessions,
    suggestedPractices,
    suggestedPrompts,
    crisisFlagCount,
  });
});

router.get("/trends", async (_req, res) => {
  const rows = await db
    .select()
    .from(checkinsTable)
    .orderBy(asc(checkinsTable.createdAt))
    .limit(60);
  res.json({
    points: rows.map((r) => ({
      date: r.createdAt,
      distress: r.distress,
      meaning: r.meaning,
      connection: r.connection,
      functioning: r.functioning,
    })),
  });
});

export default router;
