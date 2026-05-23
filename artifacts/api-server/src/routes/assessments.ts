import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  checkinsTable,
  safetyEventsTable,
  screenerResultsTable,
  profileTable,
} from "@workspace/db";
import { CreateCheckInBody, SubmitGisScreenerBody } from "@workspace/api-zod";
import { tierFromGisScore, gisSafetySignal, GIS_CLINICAL_CUTPOINT } from "../lib/clinical";

const router: IRouter = Router();

router.get("/checkins", async (_req, res) => {
  const rows = await db.select().from(checkinsTable).orderBy(desc(checkinsTable.createdAt));
  res.json(rows);
});

router.post("/checkins", async (req, res) => {
  const body = CreateCheckInBody.parse(req.body);
  const [row] = await db.insert(checkinsTable).values(body).returning();
  if (body.safetyConcern) {
    await db.insert(safetyEventsTable).values({
      source: "checkin",
      severity: "warning",
      note: body.note ?? "Safety concern indicated on check-in",
    });
  }
  res.status(201).json(row);
});

/**
 * GIS — Grief Impairment Scale (Lee & Neimeyer, Death Studies 2022).
 * Scores the 5 items (0-4 each), assigns a public-health tier, and
 * triggers the safety layer when item 3 (self-destructive coping) >= 2.
 */
router.get("/gis", async (_req, res) => {
  const rows = await db
    .select()
    .from(screenerResultsTable)
    .where(eq(screenerResultsTable.instrument, "GIS"))
    .orderBy(desc(screenerResultsTable.completedAt));
  res.json(
    rows.map((r) => {
      const numeric = Object.fromEntries(
        Object.entries(r.itemResponses).map(([k, v]) => [Number(k.replace("item", "")), v]),
      );
      return {
        id: r.id,
        score: r.score,
        tier: r.tierAssigned,
        cutPointFlag: r.cutPointFlag,
        safetyFlag: gisSafetySignal(numeric).flag,
        itemResponses: r.itemResponses,
        completedAt: r.completedAt,
      };
    }),
  );
});

router.post("/gis", async (req, res) => {
  const body = SubmitGisScreenerBody.parse(req.body);
  const items: Record<number, number> = {
    1: body.item1,
    2: body.item2,
    3: body.item3,
    4: body.item4,
    5: body.item5,
  };
  const score = body.item1 + body.item2 + body.item3 + body.item4 + body.item5;
  const tier = tierFromGisScore(score);
  const cutPointFlag = score >= GIS_CLINICAL_CUTPOINT;
  const safety = gisSafetySignal(items);

  const itemResponses = {
    item1: body.item1,
    item2: body.item2,
    item3: body.item3,
    item4: body.item4,
    item5: body.item5,
  };

  const [row] = await db
    .insert(screenerResultsTable)
    .values({
      instrument: "GIS",
      itemResponses,
      score,
      cutPointFlag,
      tierAssigned: tier,
    })
    .returning();

  // Persist tier on the (single-user) profile so the companion can route on it.
  const [existing] = await db.select().from(profileTable).orderBy(profileTable.id).limit(1);
  if (existing) {
    await db
      .update(profileTable)
      .set({ tier, gisScore: score, gisCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(profileTable.id, existing.id));
  }

  // Safety layer: PDF Section C/E — item 3 >= 2 (unhealthy/self-destructive
  // coping) and item 5 >= 3 (withdrawal from others) are structured triggers
  // that route to the safety layer regardless of total. Never silently scored.
  for (const trig of safety.triggers) {
    if (trig === "item3") {
      await db.insert(safetyEventsTable).values({
        source: "gis_item3",
        severity: body.item3 >= 3 ? "critical" : "warning",
        note: `GIS item 3 score ${body.item3} indicates unhealthy coping. Total ${score}.`,
      });
    } else {
      await db.insert(safetyEventsTable).values({
        source: "gis_item5",
        severity: "warning",
        note: `GIS item 5 score ${body.item5} indicates social withdrawal. Total ${score}.`,
      });
    }
  }

  res.status(200).json({
    id: row.id,
    score,
    tier,
    cutPointFlag,
    safetyFlag: safety.flag,
    itemResponses,
    completedAt: row.completedAt,
  });
});

export default router;
