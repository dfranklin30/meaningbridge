import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, intakesTable, patientsTable, providersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { encryptPhi, encryptPhiJson, decryptPhiJson } from "../lib/phi";
import { getPatientForProvider, linkProviderToPatient } from "../lib/patientAccess";
import { generateConsentToken } from "../lib/consentToken";
import { sendConsentInvite } from "../lib/consentInvite";
import { appOrigin } from "../lib/appUrl";
import { toIntakeView, parseId } from "../lib/professionalViews";

/** Narrow an unknown intake-blob value to a trimmed non-empty string, or null. */
function optString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const router: IRouter = Router();

/**
 * Multi-step intake forms. The full payload is encrypted as one blob; drafts
 * are scoped to the provider who owns them, and any linked patient must be one
 * the provider can access. Reads/writes are audited.
 */

// Note: `status` is intentionally NOT client-writable. Intakes are created as
// drafts and only advance to "submitted" through POST /intakes/:id/submit, which
// performs patient creation, consent-token minting, the invite email, and the
// safety gate. Accepting a client-supplied status would let callers reach
// "submitted" while skipping those side effects.
const intakeInput = z.object({
  patientId: z.number().int().positive().optional(),
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

router.get("/intakes", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select()
    .from(intakesTable)
    .where(eq(intakesTable.providerUserId, req.userId!))
    .orderBy(desc(intakesTable.updatedAt));

  await audit(req, "intake.list", { detail: `${rows.length} intakes` });

  res.json(
    rows.map((r) => {
      const data = (decryptPhiJson(r.dataEnc) ?? {}) as Record<string, unknown>;
      const identity = (data.identity ?? {}) as Record<string, unknown>;
      const label =
        [optString(identity.firstName), optString(identity.lastName)]
          .filter(Boolean)
          .join(" ") || null;
      return {
        id: r.id,
        status: r.status,
        patientId: r.patientId,
        patientLabel: label,
        riskFlag: r.riskFlag,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    }),
  );
});

router.post("/intakes", requireAuth, requireProfessional, async (req, res) => {
  const parsed = intakeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid intake", details: parsed.error.issues });
    return;
  }
  const { patientId, data, riskFlag, safetyPlanConfirmed } = parsed.data;

  if (patientId !== undefined) {
    const patient = await getPatientForProvider(req.userId!, patientId);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
  }

  const [row] = await db
    .insert(intakesTable)
    .values({
      providerUserId: req.userId!,
      patientId: patientId ?? null,
      status: "draft",
      dataEnc: encryptPhiJson(data),
      riskFlag: riskFlag ?? false,
      safetyPlanConfirmed: safetyPlanConfirmed ?? false,
      submittedAt: null,
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

  // Already submitted: return it (idempotent, avoids minting a second token).
  if (existing.status === "submitted") {
    res.json(toIntakeView(existing));
    return;
  }

  // Server-side safety gate: a risk-flagged intake cannot be submitted until the
  // provider confirms a safety plan is in place. Mirrors the UI banner, but is
  // enforced here so the UI can never be bypassed.
  if (existing.riskFlag && !existing.safetyPlanConfirmed) {
    res.status(400).json({
      error: "A safety plan must be confirmed before submitting a risk-flagged intake.",
      code: "safety_plan_required",
    });
    return;
  }

  const data = (decryptPhiJson(existing.dataEnc) ?? {}) as Record<string, unknown>;
  const identity = (data.identity ?? {}) as Record<string, unknown>;
  const firstName = optString(identity.firstName);
  if (!firstName) {
    res.status(400).json({ error: "A patient first name is required before submitting." });
    return;
  }
  const email = optString(identity.email);

  // Create the patient record from the intake if one is not already linked, and
  // grant the submitting provider owner access.
  let patientId = existing.patientId;
  if (!patientId) {
    const [patient] = await db
      .insert(patientsTable)
      .values({
        ownerProviderUserId: req.userId!,
        status: "draft",
        firstNameEnc: encryptPhi(firstName),
        lastNameEnc: encryptPhi(optString(identity.lastName)),
        dobEnc: encryptPhi(optString(identity.dob)),
        emailEnc: encryptPhi(email),
        phoneEnc: encryptPhi(optString(identity.phone)),
        pronouns: optString(identity.pronouns),
      })
      .returning();
    patientId = patient!.id;
    await linkProviderToPatient(req.userId!, patientId, "owner");
    await audit(req, "patient.create", { detail: `patient ${patientId} via intake ${id}` });
  }

  // Mint a single-use consent token; store only its hash. The patient's status
  // becomes "invited" until they e-sign via the emailed link.
  const { token, hash } = generateConsentToken();
  await db
    .update(patientsTable)
    .set({ status: "invited", consentTokenHash: hash })
    .where(eq(patientsTable.id, patientId));

  const [row] = await db
    .update(intakesTable)
    .set({ status: "submitted", patientId, submittedAt: new Date() })
    .where(eq(intakesTable.id, id))
    .returning();

  await audit(req, "intake.submit", { detail: `intake ${id} patient ${patientId}` });

  // Fire-and-forget consent invite. The response must never wait on SMTP.
  if (email) {
    const [provider] = await db
      .select({ fullName: providersTable.fullName })
      .from(providersTable)
      .where(eq(providersTable.userId, req.userId!))
      .limit(1);
    const origin = appOrigin(req);
    void sendConsentInvite({
      to: email,
      firstName,
      providerName: provider?.fullName ?? null,
      token,
      origin,
    }).catch((err) => {
      req.log.error({ err }, "consent invite dispatch failed");
    });
  }

  res.json(toIntakeView(row!));
});

export default router;
