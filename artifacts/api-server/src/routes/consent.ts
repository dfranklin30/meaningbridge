import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, patientsTable, consentsTable, providersTable } from "@workspace/db";
import { logAudit as audit, clientIp } from "../lib/audit";
import { encryptPhi, decryptPhi } from "../lib/phi";
import { hashConsentToken } from "../lib/consentToken";
import { CONSENT_DOCUMENT_VERSION } from "../lib/professionalMeta";

const router: IRouter = Router();

/**
 * PUBLIC patient consent e-sign flow. Reached from the secure link emailed to a
 * patient after a provider submits their intake. Authentication is the bearer
 * consent token itself (never a Clerk session): the token is hashed and matched
 * against `patients.consentTokenHash`. Deliberately outside the professional
 * (Clerk + 2FA) gate so a patient — who has no account — can review and sign.
 * The response exposes only the minimum the consent page needs; no other PHI.
 */

/** Resolve the patient a raw consent token belongs to, or null. */
async function patientByToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const hash = hashConsentToken(trimmed);
  const [row] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.consentTokenHash, hash))
    .limit(1);
  return row ?? null;
}

const NOT_VALID = "This link is not valid or has expired. Please contact your clinician.";

router.get("/:token", async (req, res) => {
  const patient = await patientByToken(req.params.token);
  if (!patient) {
    res.status(404).json({ error: NOT_VALID });
    return;
  }

  const [provider] = await db
    .select({ fullName: providersTable.fullName, practiceName: providersTable.practiceName })
    .from(providersTable)
    .where(eq(providersTable.userId, patient.ownerProviderUserId))
    .limit(1);

  const alreadySigned = patient.status === "consented" || patient.status === "active";
  res.json({
    firstName: decryptPhi(patient.firstNameEnc),
    providerName: provider?.fullName ?? null,
    practiceName: provider?.practiceName ?? null,
    documentVersion: CONSENT_DOCUMENT_VERSION,
    status: patient.status,
    alreadySigned,
    closed: patient.status === "revoked" || patient.status === "inactive",
  });
});

const signInput = z.object({
  signerName: z.string().min(1),
  agree: z.literal(true),
});

router.post("/:token", async (req, res) => {
  const patient = await patientByToken(req.params.token);
  if (!patient) {
    res.status(404).json({ error: NOT_VALID });
    return;
  }

  const parsed = signInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please type your name and confirm your agreement to continue." });
    return;
  }

  if (patient.status === "revoked" || patient.status === "inactive") {
    res.status(409).json({ error: "This invitation is no longer active." });
    return;
  }

  // Idempotent: a re-submitted link (double click, refresh) simply confirms.
  if (patient.status === "consented" || patient.status === "active") {
    res.json({ status: patient.status });
    return;
  }

  const now = new Date();
  await db.insert(consentsTable).values({
    patientId: patient.id,
    type: "patient_data_use",
    documentVersion: CONSENT_DOCUMENT_VERSION,
    signerNameEnc: encryptPhi(parsed.data.signerName.trim()),
    signedAt: now,
    ipAddress: clientIp(req),
  });

  // Single-use: clear the token hash so the emailed link cannot be replayed to
  // read patient details or re-sign after consent is captured.
  await db
    .update(patientsTable)
    .set({ status: "consented", consentTokenHash: null })
    .where(eq(patientsTable.id, patient.id));
  await audit(req, "consent.record", { detail: `patient ${patient.id} self-signed` });

  res.status(201).json({ status: "consented" });
});

export default router;
