import { Router, type IRouter } from "express";
import { and, desc, eq, getTableColumns, isNull, notInArray, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, intakesTable, patientsTable, providersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { encryptPhiJson, decryptPhiJson } from "../lib/phi";
import { getPatientForProvider } from "../lib/patientAccess";
import { generateConsentToken } from "../lib/consentToken";
import { sendConsentInvite } from "../lib/consentInvite";
import { appOrigin } from "../lib/appUrl";
import { enrollInvitedPatient } from "../lib/patientEnrollment";
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

// Closed patient statuses that end provider visibility (mirrors patientAccess).
// Once a patient withdraws consent (status "revoked"), their intake — which
// duplicates identity PHI — must disappear from the provider too. Unlinked
// drafts (patientId null) have no patient and remain visible to their author.
const HIDDEN_PATIENT_STATUSES = ["revoked", "inactive"] as const;
const intakePatientVisible = or(
  isNull(intakesTable.patientId),
  notInArray(patientsTable.status, [...HIDDEN_PATIENT_STATUSES]),
);

/** Load an intake owned by the current provider and still visible, or null. */
async function ownedIntake(providerUserId: number, id: number) {
  const [row] = await db
    .select(getTableColumns(intakesTable))
    .from(intakesTable)
    .leftJoin(patientsTable, eq(patientsTable.id, intakesTable.patientId))
    .where(
      and(
        eq(intakesTable.id, id),
        eq(intakesTable.providerUserId, providerUserId),
        intakePatientVisible,
      ),
    )
    .limit(1);
  return row ?? null;
}

router.get("/intakes", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select(getTableColumns(intakesTable))
    .from(intakesTable)
    .leftJoin(patientsTable, eq(patientsTable.id, intakesTable.patientId))
    .where(and(eq(intakesTable.providerUserId, req.userId!), intakePatientVisible))
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
  // Email is required: submit is the only point where the consent token is minted
  // and the invite is sent. Allowing an email-less submit would strand the patient
  // in "invited" with no way to ever receive the consent link.
  const email = optString(data.identity.email);
  if (!email) {
    res.status(400).json({
      error: "A patient email is required to send the consent invite before submitting.",
      code: "email_required",
    });
    return;
  }

  const [provider] = await db
    .select({ fullName: providersTable.fullName })
    .from(providersTable)
    .where(eq(providersTable.userId, req.userId!))
    .limit(1);
  const providerName = provider?.fullName ?? null;
  const origin = appOrigin(req);

  // Create the patient record from the intake if one is not already linked. The
  // shared enrollment helper (also used by the bulk importer) creates the
  // PHI-encrypted patient, grants owner access, mints a consent token, moves the
  // patient to "invited", and dispatches the invite fire-and-forget.
  let patientId = existing.patientId;
  if (!patientId) {
    const enrolled = await enrollInvitedPatient({
      providerUserId: req.userId!,
      firstName,
      lastName: optString(data.identity.lastName),
      dob: optString(data.identity.dob),
      email,
      phone: optString(data.identity.phone),
      pronouns: optString(data.identity.pronouns),
      providerName,
      origin,
      log: req.log,
    });
    patientId = enrolled.patientId;
    await audit(req, "patient.create", { detail: `patient ${patientId} via intake ${id}` });
  } else {
    // Already-linked patient: re-mint the token, move to "invited", re-send the
    // invite so the patient can (re)sign consent.
    const { token, hash } = generateConsentToken();
    await db
      .update(patientsTable)
      .set({ status: "invited", consentTokenHash: hash })
      .where(eq(patientsTable.id, patientId));
    void sendConsentInvite({ to: email, firstName, providerName, token, origin }).catch((err) => {
      req.log.error({ err }, "consent invite dispatch failed");
    });
  }

  const [row] = await db
    .update(intakesTable)
    .set({ status: "submitted", patientId, submittedAt: new Date() })
    .where(eq(intakesTable.id, id))
    .returning();

  await audit(req, "intake.submit", { detail: `intake ${id} patient ${patientId}` });

  res.json(toIntakeView(row!));
});

export default router;
