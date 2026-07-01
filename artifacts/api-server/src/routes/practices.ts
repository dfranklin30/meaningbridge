import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, practicesTable } from "@workspace/db";
import {
  GetPracticeParams,
  CreatePracticeBody,
  UpdatePracticeParams,
  UpdatePracticeBody,
  DeletePracticeParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Find a slug that is unique across practices, optionally excluding one id. */
async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || "practice";
  let candidate = root;
  let n = 2;
  // Loop until no other row holds the candidate slug.
  // Practices are few, so a simple per-candidate lookup is fine.
  for (;;) {
    const where = excludeId
      ? and(eq(practicesTable.slug, candidate), ne(practicesTable.id, excludeId))
      : eq(practicesTable.slug, candidate);
    const [clash] = await db
      .select({ id: practicesTable.id })
      .from(practicesTable)
      .where(where);
    if (!clash) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
}

router.get("/", async (_req, res) => {
  const rows = await db.select().from(practicesTable).orderBy(practicesTable.id);
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const { id } = GetPracticeParams.parse(req.params);
  const [row] = await db.select().from(practicesTable).where(eq(practicesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/", requireAuth, async (req, res) => {
  const body = CreatePracticeBody.parse(req.body);
  const slug = await uniqueSlug(body.slug || body.title);
  const [row] = await db
    .insert(practicesTable)
    .values({
      slug,
      title: body.title,
      category: body.category,
      durationMinutes: body.durationMinutes,
      summary: body.summary,
      steps: body.steps,
      breathPattern: body.breathPattern ?? null,
    })
    .returning();
  res.status(201).json(row);
});

router.put("/:id", requireAuth, async (req, res) => {
  const { id } = UpdatePracticeParams.parse(req.params);
  const body = UpdatePracticeBody.parse(req.body);
  const slug = await uniqueSlug(body.slug || body.title, id);
  const [row] = await db
    .update(practicesTable)
    .set({
      slug,
      title: body.title,
      category: body.category,
      durationMinutes: body.durationMinutes,
      summary: body.summary,
      steps: body.steps,
      breathPattern: body.breathPattern ?? null,
    })
    .where(eq(practicesTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = DeletePracticeParams.parse(req.params);
  await db.delete(practicesTable).where(eq(practicesTable.id, id));
  res.status(204).end();
});

export default router;
