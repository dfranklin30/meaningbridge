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

// Structured, validated intake payload. Every field is optional/defaulted so a
// partial draft can be saved and resumed, but the shape and numeric screening
// ranges are enforced server-side (the client UI can never be the only guard).
const optStr = z.string().optional().default("");

/** Optional whole-number screening score in [0, max], accepted as a string. */
const scoreStr = (max: number) =>
  z
    .string()
    .default("")
    .refine((v) => v.trim() === "" || (/^\d+$/.test(v.trim()) && Number(v.trim()) <= max), {
      message: `Enter a whole number between 0 and ${max}.`,
    });

const intakeDataSchema = z.object({
  identity: z.object({
    firstName: optStr,
    lastName: optStr,
    dob: optStr,
    pronouns: optStr,
    phone: optStr,
    email: optStr,
    preferredContact: optStr,
    emergencyName: optStr,
    emergencyPhone: optStr,
  }),
  loss: z.object({ relationship: optStr, dateOfLoss: optStr, causeCategory: optStr }),
  clinical: z.object({
    pg13r: scoreStr(50),
    phq9: scoreStr(27),
    gad7: scoreStr(21),
    cssrsFlag: z.boolean().default(false),
    activeSuicidalIdeation: z.boolean().default(false),
    diagnoses: optStr,
    icd10: z.array(z.string()).default([]),
    medications: optStr,
    treatments: z.array(z.string()).default([]),
  }),
  goals: z.object({ selected: z.array(z.string()).default([]), freeText: optStr }),
});

type IntakeData = z.infer<typeof intakeDataSchema>;

/**
 * Risk is derived server-side from the clinical answers, never trusted from a
 * client-supplied flag. A caller cannot submit an intake indicating suicidal
 * ideation while claiming riskFlag=false to slip past the safety gate.
 */
function deriveRiskFlag(data: IntakeData): boolean {
  return Boolean(data.clinical.cssrsFlag || data.clinical.activeSuicidalIdeation);
}

// Note: `status` and `riskFlag` are intentionally NOT client-writable. Intakes
// are created as drafts and only advance to "submitted" through
// POST /intakes/:id/submit, which performs patient creation, consent-token
// minting, the invite email, and the safety gate. riskFlag is computed from the
// validated clinical answers on every write.
const intakeInput = z.object({
  patientId: z.number().int().positive().optional(),
  data: intakeDataSchema,
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
  const { patientId, data, safetyPlanConfirmed } = parsed.data;

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
      riskFlag: deriveRiskFlag(data),
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
  if (parsed.data.data !== undefined) {
    patch.dataEnc = encryptPhiJson(parsed.data.data);
    // Re-derive risk from the validated clinical answers on every content update.
    patch.riskFlag = deriveRiskFlag(parsed.data.data);
  }
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

  // Re-validate the stored intake at the authoritative gate. Structure and
  // numeric screening ranges must hold before we create a patient from it.
  const parsedData = intakeDataSchema.safeParse(decryptPhiJson(existing.dataEnc) ?? {});
  if (!parsedData.success) {
    res.status(400).json({
      error: "This intake has invalid or incomplete data and cannot be submitted.",
      details: parsedData.error.issues,
    });
    return;
  }
  const data = parsedData.data;

  // Server-side safety gate: risk is derived from the clinical answers (never a
  // client flag), so a risk-flagged intake cannot be submitted until the provider
  // confirms a safety plan is in place. Enforced here so the UI can never be bypassed.
  if (deriveRiskFlag(data) && !existing.safetyPlanConfirmed) {
    res.status(400).json({
      error: "A safety plan must be confirmed before submitting a risk-flagged intake.",
      code: "safety_plan_required",
    });
    return;
  }

  const firstName = optString(data.identity.firstName);
  if (!firstName) {
    res.status(400).json({ error: "A patient first name is required before submitting." });
    return;
  }
  const email = optString(data.identity.email);

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
        lastNameEnc: encryptPhi(optString(data.identity.lastName)),
        dobEnc: encryptPhi(optString(data.identity.dob)),
        emailEnc: encryptPhi(email),
        phoneEnc: encryptPhi(optString(data.identity.phone)),
        pronouns: optString(data.identity.pronouns),
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
