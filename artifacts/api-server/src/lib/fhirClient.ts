import { createHash, randomBytes } from "node:crypto";
import type { FhirConfig } from "./fhirConfig";

/**
 * A minimal SMART-on-FHIR (OAuth 2.0 + PKCE) client, read-only.
 *
 * Flow: discover the vendor's authorize/token endpoints from its
 * `.well-known/smart-configuration`, send the provider through the standalone
 * authorization-code flow with a `launch/patient` scope (the EHR shows its own
 * patient picker), exchange the returned code for an access token, then fetch the
 * selected Patient plus the two optional clinical resources we map into an
 * intake. We never request or perform any write. Only the minimum-necessary
 * fields are extracted; nothing else from the EHR is stored.
 */

// --- PKCE -------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface Pkce {
  codeVerifier: string;
  codeChallenge: string;
}

/** Generate a PKCE verifier and its S256 challenge. */
export function generatePkce(): Pkce {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

/** An opaque, unguessable CSRF state value. */
export function generateState(): string {
  return base64url(randomBytes(24));
}

// --- Discovery --------------------------------------------------------------

export interface SmartEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string | null;
}

export class FhirError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/** Fetch and validate the vendor's SMART discovery document. */
export async function discoverSmartEndpoints(iss: string): Promise<SmartEndpoints> {
  const url = `${iss.replace(/\/+$/, "")}/.well-known/smart-configuration`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new FhirError("Could not reach the EHR's SMART configuration.", "discovery_unreachable");
  }
  if (!res.ok) {
    throw new FhirError(
      `The EHR's SMART configuration returned ${res.status}.`,
      "discovery_failed",
    );
  }
  const doc = (await res.json().catch(() => null)) as {
    authorization_endpoint?: string;
    token_endpoint?: string;
    revocation_endpoint?: string;
  } | null;
  if (!doc?.authorization_endpoint || !doc?.token_endpoint) {
    throw new FhirError("The EHR's SMART configuration was incomplete.", "discovery_incomplete");
  }
  return {
    authorizationEndpoint: doc.authorization_endpoint,
    tokenEndpoint: doc.token_endpoint,
    revocationEndpoint: doc.revocation_endpoint ?? null,
  };
}

// --- Authorization URL ------------------------------------------------------

export function buildAuthorizeUrl(args: {
  authorizationEndpoint: string;
  config: FhirConfig;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(args.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", args.config.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("scope", args.config.scopes);
  url.searchParams.set("state", args.state);
  url.searchParams.set("aud", args.config.iss);
  url.searchParams.set("code_challenge", args.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// --- Token exchange ---------------------------------------------------------

export interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  /** The patient id the provider selected in the EHR picker, if granted. */
  patient: string | null;
  expiresAt: Date | null;
}

export async function exchangeCode(args: {
  tokenEndpoint: string;
  config: FhirConfig;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
    client_id: args.config.clientId,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  // Confidential apps authenticate with HTTP Basic; public (PKCE-only) apps do not.
  if (args.config.clientSecret) {
    const basic = Buffer.from(`${args.config.clientId}:${args.config.clientSecret}`).toString(
      "base64",
    );
    headers.Authorization = `Basic ${basic}`;
  }

  let res: Response;
  try {
    res = await fetch(args.tokenEndpoint, { method: "POST", headers, body });
  } catch {
    throw new FhirError("Could not reach the EHR's token endpoint.", "token_unreachable");
  }
  if (!res.ok) {
    throw new FhirError("The EHR rejected the authorization.", "token_exchange_failed");
  }
  const tok = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    patient?: string;
    expires_in?: number;
  } | null;
  if (!tok?.access_token) {
    throw new FhirError("The EHR did not return an access token.", "token_missing");
  }
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token ?? null,
    scope: tok.scope ?? null,
    patient: tok.patient ?? null,
    expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
  };
}

// --- Resource fetch ---------------------------------------------------------

async function fhirGet(fhirBaseUrl: string, path: string, accessToken: string): Promise<unknown> {
  const url = `${fhirBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/fhir+json" },
  });
  if (!res.ok) {
    throw new FhirError(`The EHR returned ${res.status} for ${path}.`, "resource_fetch_failed");
  }
  return res.json();
}

function bundleEntries(bundle: unknown): Record<string, unknown>[] {
  const entry = (bundle as { entry?: { resource?: unknown }[] } | null)?.entry;
  if (!Array.isArray(entry)) return [];
  return entry
    .map((e) => e?.resource)
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
}

export interface FhirPatientPull {
  patient: Record<string, unknown>;
  conditions: Record<string, unknown>[];
  medications: Record<string, unknown>[];
}

/**
 * Fetch the selected Patient and (best-effort) their Conditions and
 * MedicationRequests. Clinical resource failures are tolerated — demographics
 * alone are enough to prefill an intake — but a missing Patient is fatal.
 */
export async function fetchPatientPull(args: {
  fhirBaseUrl: string;
  accessToken: string;
  patientId: string;
}): Promise<FhirPatientPull> {
  const { fhirBaseUrl, accessToken, patientId } = args;
  const patient = (await fhirGet(
    fhirBaseUrl,
    `Patient/${encodeURIComponent(patientId)}`,
    accessToken,
  )) as Record<string, unknown>;

  const conditions = await fhirGet(
    fhirBaseUrl,
    `Condition?patient=${encodeURIComponent(patientId)}&_count=25`,
    accessToken,
  )
    .then(bundleEntries)
    .catch(() => []);

  const medications = await fhirGet(
    fhirBaseUrl,
    `MedicationRequest?patient=${encodeURIComponent(patientId)}&_count=25`,
    accessToken,
  )
    .then(bundleEntries)
    .catch(() => []);

  return { patient, conditions, medications };
}

// --- Mapping FHIR -> intake data -------------------------------------------

type Str = string;

interface HumanName {
  use?: string;
  family?: string;
  given?: string[];
  text?: string;
}

interface ContactPoint {
  system?: string;
  value?: string;
  use?: string;
}

interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

interface CodeableConcept {
  text?: string;
  coding?: Coding[];
}

function pickName(patient: Record<string, unknown>): { first: Str; last: Str } {
  const names = (patient.name as HumanName[] | undefined) ?? [];
  const official = names.find((n) => n.use === "official") ?? names.find((n) => n.use === "usual");
  const chosen = official ?? names[0];
  if (!chosen) return { first: "", last: "" };
  const first = (chosen.given ?? []).join(" ").trim();
  const last = (chosen.family ?? "").trim();
  return { first, last };
}

function pickTelecom(patient: Record<string, unknown>, system: string): Str {
  const telecom = (patient.telecom as ContactPoint[] | undefined) ?? [];
  const match =
    telecom.find((t) => t.system === system && t.use === "mobile") ??
    telecom.find((t) => t.system === system);
  return (match?.value ?? "").trim();
}

function conceptText(c: CodeableConcept | undefined): Str {
  if (!c) return "";
  if (c.text) return c.text.trim();
  const display = (c.coding ?? []).map((cd) => cd.display).find(Boolean);
  return (display ?? "").trim();
}

function icd10Codes(concept: CodeableConcept | undefined): string[] {
  const coding = concept?.coding ?? [];
  return coding
    .filter((c) => (c.system ?? "").toLowerCase().includes("icd-10") && c.code)
    .map((c) => c.code!.trim());
}

/**
 * Map a FHIR patient pull onto the intake data shape (see professionalIntakes
 * intakeDataSchema). Only demographic identity plus optional diagnoses/meds are
 * populated; screening scores and the safety gate are always left for the
 * clinician to complete in the intake editor.
 */
export function mapPullToIntakeData(pull: FhirPatientPull) {
  const { first, last } = pickName(pull.patient);
  const dob = ((pull.patient.birthDate as string | undefined) ?? "").trim();

  const diagnoses = pull.conditions
    .map((c) => conceptText(c.code as CodeableConcept | undefined))
    .filter(Boolean);
  const icd10 = Array.from(
    new Set(
      pull.conditions.flatMap((c) => icd10Codes(c.code as CodeableConcept | undefined)),
    ),
  );
  const medications = pull.medications
    .map((m) => conceptText(m.medicationCodeableConcept as CodeableConcept | undefined))
    .filter(Boolean);

  return {
    identity: {
      firstName: first,
      lastName: last,
      dob,
      pronouns: "",
      phone: pickTelecom(pull.patient, "phone"),
      email: pickTelecom(pull.patient, "email"),
      preferredContact: "",
      emergencyName: "",
      emergencyPhone: "",
    },
    loss: { relationship: "", dateOfLoss: "", causeCategory: "" },
    clinical: {
      pg13r: "",
      phq9: "",
      gad7: "",
      cssrsFlag: false,
      activeSuicidalIdeation: false,
      diagnoses: diagnoses.join("; "),
      icd10,
      medications: medications.join("; "),
      treatments: [] as string[],
    },
    goals: { selected: [] as string[], freeText: "" },
  };
}
