import { Router, type IRouter } from "express";
import { db, therapistsTable } from "@workspace/db";
import { FindTherapistsQueryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/therapists", async (req, res) => {
  const { zip } = FindTherapistsQueryParams.parse(req.query);
  const base = db.select().from(therapistsTable);
  const rows = zip
    ? await base.where(eq(therapistsTable.zip, zip))
    : await base;
  res.json(rows);
});

export default router;
