import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, patientsTable, consentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit, clientIp } from "../lib/audit";
import { encryptPhi } from "../lib/phi";
import { hashConsentToken } from "../lib/consentToken";
import {
  getPatientForProvider,
  listPatientsForProvider,
  linkProviderToPatient,
} from "../lib/patientAccess";
import { toPatientSummary, toConsentView, parseId } from "../lib/professionalViews";

const router: IRouter = Router();

/**
 * Patient CRUD. Every identifying field is PHI and encrypted at rest; access is
 * granted only through `provider_patient_links` (see patientAccess); and every
 * create / read / update / delete emits an audit-log entry.
 */

const patientInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  dob: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  pronouns: z.string().optional(),
});

const consentInput = z.object({
  consentToken: z.string().min(1),
  signerName: z.string().min(1),
  documentVersion: z.string().optional(),
});

/** Map decrypted PatientInput fields onto encrypted columns. */
function encFields(data: z.infer<typeof patientInput> | Partial<z.infer<typeof patientInput>>) {
  const out: Record<string, string | null> = {};
  if (data.firstName !== undefined) out.firstNameEnc = encryptPhi(data.firstName);
  if (data.lastName !== undefined) out.lastNameEnc = encryptPhi(data.lastName);
  if (data.dob !== undefined) out.dobEnc = encryptPhi(data.dob);
  if (data.email !== undefined) out.emailEnc = encryptPhi(data.email);
  if (data.phone !== undefined) out.phoneEnc = encryptPhi(data.phone);
  if (data.pronouns !== undefined) out.pronouns = data.pronouns;
  return out;
}

router.get("/patients", requireAuth, requireProfessional, async (req, res) => {
  const rows = await listPatientsForProvider(req.userId!);
  await audit(req, "patient.list", { detail: `${rows.length} patients` });
  res.json(rows.map(toPatientSummary));
});

router.post("/patients", requireAuth, requireProfessional, async (req, res) => {
  const parsed = patientInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid patient", details: parsed.error.issues });
    return;
  }

  const [row] = await db
    .insert(patientsTable)
    .values({ ownerProviderUserId: req.userId!, status: "draft", ...encFields(parsed.data) })
    .returning();
  await linkProviderToPatient(req.userId!, row!.id, "owner");

  await audit(req, "patient.create", { subjectUserId: null, detail: `patient ${row!.id}` });
  res.status(201).json(toPatientSummary(row!));
});

router.get("/patients/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await audit(req, "patient.view", { detail: `patient ${id}` });
  res.json(toPatientSummary(patient));
});

router.patch("/patients/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = patientInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid patient", details: parsed.error.issues });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [row] = await db
    .update(patientsTable)
    .set(encFields(parsed.data))
    .where(eq(patientsTable.id, id))
    .returning();

  await audit(req, "patient.update", { detail: `patient ${id}` });
  res.json(toPatientSummary(row!));
});

router.delete("/patients/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(patientsTable).where(eq(patientsTable.id, id));
  await audit(req, "patient.delete", { detail: `patient ${id}` });
  res.status(204).end();
});

// ---- consents (scoped to a patient) ---------------------------------------

router.get("/patients/:id/consents", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const rows = await db
    .select()
    .from(consentsTable)
    .where(eq(consentsTable.patientId, id))
    .orderBy(desc(consentsTable.createdAt));
  await audit(req, "consent.list", { detail: `patient ${id}` });
  res.json(rows.map(toConsentView));
});

router.post("/patients/:id/consents", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = consentInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid consent", details: parsed.error.issues });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // If a consent token was issued for this patient, the presented token must
  // match its stored hash. (Pilot: providers may attest consent for patients
  // enrolled before a token was issued.)
  if (patient.consentTokenHash) {
    if (hashConsentToken(parsed.data.consentToken) !== patient.consentTokenHash) {
      res.status(400).json({ error: "Invalid consent token" });
      return;
    }
  }

  const now = new Date();
  const [row] = await db
    .insert(consentsTable)
    .values({
      patientId: id,
      type: "patient_data_use",
      documentVersion: parsed.data.documentVersion ?? null,
      signerNameEnc: encryptPhi(parsed.data.signerName),
      signedAt: now,
      ipAddress: clientIp(req),
    })
    .returning();

  await db.update(patientsTable).set({ status: "consented" }).where(eq(patientsTable.id, id));

  await audit(req, "consent.record", { detail: `patient ${id}` });
  res.status(201).json(toConsentView(row!));
});

export default router;
