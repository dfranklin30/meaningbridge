import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, intakesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { encryptPhiJson } from "../lib/phi";
import { getPatientForProvider } from "../lib/patientAccess";
import { toIntakeView, parseId } from "../lib/professionalViews";

const router: IRouter = Router();

/**
 * Multi-step intake forms. The full payload is encrypted as one blob; drafts
 * are scoped to the provider who owns them, and any linked patient must be one
 * the provider can access. Reads/writes are audited.
 */

const intakeInput = z.object({
  patientId: z.number().int().positive().optional(),
  status: z.enum(["draft", "submitted"]).optional(),
  data: z.record(z.string(), z.unknown()),
  riskFlag: z.boolean().optional(),
  safetyPlanConfirmed: z.boolean().optional(),
});

/** Load an intake owned by the current provider, or null. */
async function ownedIntake(providerUserId: number, id: number) {
  const [row] = await db
    .select()
    .from(intakesTable)
    .where(and(eq(intakesTable.id, id), eq(intakesTable.providerUserId, providerUserId)))
    .limit(1);
  return row ?? null;
}

router.post("/intakes", requireAuth, requireProfessional, async (req, res) => {
  const parsed = intakeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid intake", details: parsed.error.issues });
    return;
  }
  const { patientId, status, data, riskFlag, safetyPlanConfirmed } = parsed.data;

  if (patientId !== undefined) {
    const patient = await getPatientForProvider(req.userId!, patientId);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
  }

  const submitted = status === "submitted";
  const [row] = await db
    .insert(intakesTable)
    .values({
      providerUserId: req.userId!,
      patientId: patientId ?? null,
      status: status ?? "draft",
      dataEnc: encryptPhiJson(data),
      riskFlag: riskFlag ?? false,
      safetyPlanConfirmed: safetyPlanConfirmed ?? false,
      submittedAt: submitted ? new Date() : null,
    })
    .returning();

  await audit(req, "intake.create", { detail: `intake ${row!.id}` });
  res.status(201).json(toIntakeView(row!));
});

router.get("/intakes/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const row = await ownedIntake(req.userId!, id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await audit(req, "intake.view", { detail: `intake ${id}` });
  res.json(toIntakeView(row));
});

router.patch("/intakes/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = intakeInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid intake", details: parsed.error.issues });
    return;
  }
  const existing = await ownedIntake(req.userId!, id);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.patientId !== undefined) {
    const patient = await getPatientForProvider(req.userId!, parsed.data.patientId);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    patch.patientId = parsed.data.patientId;
  }
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.data !== undefined) patch.dataEnc = encryptPhiJson(parsed.data.data);
  if (parsed.data.riskFlag !== undefined) patch.riskFlag = parsed.data.riskFlag;
  if (parsed.data.safetyPlanConfirmed !== undefined)
    patch.safetyPlanConfirmed = parsed.data.safetyPlanConfirmed;

  const [row] = await db
    .update(intakesTable)
    .set(patch)
    .where(eq(intakesTable.id, id))
    .returning();

  await audit(req, "intake.update", { detail: `intake ${id}` });
  res.json(toIntakeView(row!));
});

router.post("/intakes/:id/submit", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await ownedIntake(req.userId!, id);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [row] = await db
    .update(intakesTable)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(eq(intakesTable.id, id))
    .returning();

  await audit(req, "intake.submit", { detail: `intake ${id}` });
  res.json(toIntakeView(row!));
});

export default router;
