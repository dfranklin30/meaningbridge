import { Router, type IRouter } from "express";
import { desc, sql, asc, eq, and } from "drizzle-orm";
import {
  db,
  checkinsTable,
  journalEntriesTable,
  chatSessionsTable,
  chatMessagesTable,
  practicesTable,
  journalPromptsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const userId = req.userId!;

  const [latestCheckIn] = await db
    .select()
    .from(checkinsTable)
    .where(eq(checkinsTable.userId, userId))
    .orderBy(desc(checkinsTable.createdAt))
    .limit(1);

  const [{ count: checkInCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(checkinsTable)
    .where(eq(checkinsTable.userId, userId));
  const [{ count: journalCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId));
  const [{ count: sessionCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.userId, userId));
  const [{ count: crisisFlagCount }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(chatMessagesTable)
    .innerJoin(chatSessionsTable, eq(chatMessagesTable.sessionId, chatSessionsTable.id))
    .where(and(eq(chatSessionsTable.userId, userId), eq(chatMessagesTable.crisisFlag, true)));

  const recentJournal = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId))
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(3);
  const recentSessions = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.userId, userId))
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

router.get("/trends", async (req, res) => {
  const rows = await db
    .select()
    .from(checkinsTable)
    .where(eq(checkinsTable.userId, req.userId!))
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
