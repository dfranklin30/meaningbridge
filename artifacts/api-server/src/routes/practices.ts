import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, practicesTable } from "@workspace/db";
import { GetPracticeParams } from "@workspace/api-zod";

const router: IRouter = Router();

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

export default router;
