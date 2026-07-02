import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, batchImportsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { toBatchImportView, parseId } from "../lib/professionalViews";

const router: IRouter = Router();

/**
 * A record of each bulk patient import run, scoped to the provider who ran it.
 * The per-row report must not carry PHI beyond what identifies a row to that
 * provider.
 */

const batchInput = z.object({
  filename: z.string().optional(),
  source: z.string().min(1),
  totalRows: z.number().int().nonnegative().optional(),
  acceptedRows: z.number().int().nonnegative().optional(),
  rejectedRows: z.number().int().nonnegative().optional(),
  report: z
    .array(
      z.object({
        row: z.number().int(),
        ok: z.boolean(),
        reason: z.string().optional(),
      }),
    )
    .optional(),
});

router.get("/batch-imports", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select()
    .from(batchImportsTable)
    .where(eq(batchImportsTable.providerUserId, req.userId!))
    .orderBy(desc(batchImportsTable.createdAt));
  res.json(rows.map(toBatchImportView));
});

router.post("/batch-imports", requireAuth, requireProfessional, async (req, res) => {
  const parsed = batchInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid batch import", details: parsed.error.issues });
    return;
  }
  const { filename, source, totalRows, acceptedRows, rejectedRows, report } = parsed.data;

  const [row] = await db
    .insert(batchImportsTable)
    .values({
      providerUserId: req.userId!,
      filename: filename ?? null,
      source,
      totalRows: totalRows ?? 0,
      acceptedRows: acceptedRows ?? 0,
      rejectedRows: rejectedRows ?? 0,
      report: report ?? null,
    })
    .returning();

  await audit(req, "batch.create", { detail: `${acceptedRows ?? 0}/${totalRows ?? 0} accepted` });
  res.status(201).json(toBatchImportView(row!));
});

router.get("/batch-imports/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(batchImportsTable)
    .where(and(eq(batchImportsTable.id, id), eq(batchImportsTable.providerUserId, req.userId!)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toBatchImportView(row));
});

export default router;
