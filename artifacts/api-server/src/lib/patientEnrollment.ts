import { eq } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import { encryptPhi } from "./phi";
import { linkProviderToPatient } from "./patientAccess";
import { generateConsentToken } from "./consentToken";
import { sendConsentInvite } from "./consentInvite";

/**
 * The single source of truth for turning an identity record into an invited
 * patient. Both the single-intake submit flow and the bulk CSV/XLSX importer
 * call this so enrollment behaves identically no matter how a provider adds a
 * client: create the PHI-encrypted patient row, grant the provider owner
 * access, mint a single-use consent token (store only its hash), move the
 * patient to "invited", and dispatch the consent invite fire-and-forget.
 *
 * Auditing stays in the route (it needs the request); this helper is
 * request-agnostic. The invite is never awaited — callers must not block a
 * response on SMTP.
 */
export interface EnrollInvitedPatientInput {
  providerUserId: number;
  firstName: string;
  lastName: string | null;
  dob: string | null;
  email: string;
  phone: string | null;
  pronouns: string | null;
  providerName: string | null;
  origin: string;
  /** Minimal logger (req.log or the singleton logger) for invite failures. */
  log: { error: (obj: unknown, msg?: string) => void };
}

export async function enrollInvitedPatient(
  input: EnrollInvitedPatientInput,
): Promise<{ patientId: number; token: string }> {
  const [patient] = await db
    .insert(patientsTable)
    .values({
      ownerProviderUserId: input.providerUserId,
      status: "draft",
      firstNameEnc: encryptPhi(input.firstName),
      lastNameEnc: encryptPhi(input.lastName),
      dobEnc: encryptPhi(input.dob),
      emailEnc: encryptPhi(input.email),
      phoneEnc: encryptPhi(input.phone),
      pronouns: input.pronouns,
    })
    .returning();
  const patientId = patient!.id;

  await linkProviderToPatient(input.providerUserId, patientId, "owner");

  // Mint a single-use consent token; persist only its hash. The raw token is
  // emailed once and never stored.
  const { token, hash } = generateConsentToken();
  await db
    .update(patientsTable)
    .set({ status: "invited", consentTokenHash: hash })
    .where(eq(patientsTable.id, patientId));

  // Fire-and-forget: the caller's response must never wait on SMTP.
  void sendConsentInvite({
    to: input.email,
    firstName: input.firstName,
    providerName: input.providerName,
    token,
    origin: input.origin,
  }).catch((err) => {
    input.log.error({ err }, "consent invite dispatch failed");
  });

  return { patientId, token };
}
