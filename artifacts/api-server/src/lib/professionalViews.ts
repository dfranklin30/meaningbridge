import type {
  Patient,
  Provider,
  Intake,
  Consent,
  Referral,
  ReferralMessage,
  IntegrationConnection,
  BatchImport,
} from "@workspace/db";
import { decryptPhi, decryptPhiJson } from "./phi";

/**
 * Serializers that turn a raw DB row (with `Enc` PHI columns) into the
 * API-contract shape. Decryption is centralized here so no route hand-rolls
 * PHI handling, and secrets (OAuth tokens, signer names, consent-token hashes)
 * are never included in a response.
 */

export function toPatientSummary(p: Patient) {
  return {
    id: p.id,
    firstName: decryptPhi(p.firstNameEnc),
    lastName: decryptPhi(p.lastNameEnc),
    pronouns: p.pronouns,
    status: p.status,
    isDemoSample: p.isDemoSample,
    sessionCount: p.sessionCount,
    lastActiveAt: p.lastActiveAt,
    createdAt: p.createdAt,
  };
}

export function toProviderView(p: Provider) {
  return {
    id: p.id,
    userId: p.userId,
    fullName: p.fullName,
    credential: p.credential,
    licenseNumber: p.licenseNumber,
    licenseState: p.licenseState,
    npi: p.npi,
    practiceName: p.practiceName,
    practiceAddress: p.practiceAddress,
    verificationStatus: p.verificationStatus,
    verifiedAt: p.verifiedAt,
    directoryOptIn: p.directoryOptIn,
    specialtyTags: p.specialtyTags,
    statesLicensed: p.statesLicensed,
    telehealth: p.telehealth,
    acceptingReferrals: p.acceptingReferrals,
    bio: p.bio,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function toIntakeView(i: Intake) {
  return {
    id: i.id,
    providerUserId: i.providerUserId,
    patientId: i.patientId,
    status: i.status,
    data: decryptPhiJson(i.dataEnc) ?? {},
    riskFlag: i.riskFlag,
    safetyPlanConfirmed: i.safetyPlanConfirmed,
    submittedAt: i.submittedAt,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

export function toConsentView(c: Consent) {
  return {
    id: c.id,
    patientId: c.patientId,
    type: c.type,
    documentVersion: c.documentVersion,
    signedAt: c.signedAt,
    revokedAt: c.revokedAt,
    createdAt: c.createdAt,
  };
}

export function toReferralView(r: Referral) {
  return {
    id: r.id,
    patientId: r.patientId,
    fromProviderUserId: r.fromProviderUserId,
    toProviderUserId: r.toProviderUserId,
    status: r.status,
    summary: decryptPhi(r.summaryEnc),
    respondedAt: r.respondedAt,
    createdAt: r.createdAt,
  };
}

export function toReferralMessageView(m: ReferralMessage) {
  return {
    id: m.id,
    referralId: m.referralId,
    senderUserId: m.senderUserId,
    body: decryptPhi(m.bodyEnc) ?? "",
    createdAt: m.createdAt,
  };
}

export function toIntegrationView(c: IntegrationConnection) {
  return {
    id: c.id,
    system: c.system,
    kind: c.kind,
    status: c.status,
    scopes: c.scopes,
    fhirBaseUrl: c.fhirBaseUrl,
    connectedAt: c.connectedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function toBatchImportView(b: BatchImport) {
  return {
    id: b.id,
    filename: b.filename,
    source: b.source,
    totalRows: b.totalRows,
    acceptedRows: b.acceptedRows,
    rejectedRows: b.rejectedRows,
    report: b.report,
    createdAt: b.createdAt,
  };
}

/** Parse a positive integer path param; returns null when invalid. */
export function parseId(raw: unknown): number | null {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
