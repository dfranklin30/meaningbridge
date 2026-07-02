/**
 * SMART-on-FHIR client configuration, read from environment per EHR vendor.
 *
 * A live FHIR connection requires MeaningBridge to be registered as an app with
 * each EHR (Epic, athenahealth), which yields a client id and (for confidential
 * apps) a secret, plus the vendor's FHIR base URL (`iss`). Those are deployment
 * secrets, never hard-coded. When a system is not configured we surface an
 * honest "configuration required" state rather than faking a live connection —
 * the connect action is simply unavailable until an administrator registers the
 * app and sets the variables below.
 *
 * Env vars (per system, e.g. EPIC / ATHENA):
 *   FHIR_<SYS>_CLIENT_ID      required — OAuth client id
 *   FHIR_<SYS>_ISS            required — FHIR base URL used as `aud` and resource root
 *   FHIR_<SYS>_CLIENT_SECRET  optional — only for confidential (secret-bearing) apps
 *   FHIR_<SYS>_SCOPES         optional — space-delimited scope override
 */

/** FHIR-tier system ids (must match professionalMeta INTEGRATION_SYSTEMS). */
export const FHIR_SYSTEMS = ["epic", "athenahealth"] as const;
export type FhirSystem = (typeof FHIR_SYSTEMS)[number];

/** Env-var prefix for a system (e.g. "epic" -> "FHIR_EPIC"). */
const ENV_PREFIX: Record<FhirSystem, string> = {
  epic: "FHIR_EPIC",
  athenahealth: "FHIR_ATHENA",
};

/**
 * Minimum-necessary scopes: read-only patient demographics plus the two optional
 * clinical resources we map into an intake, and offline_access so a connection
 * can be recorded without an immediate re-prompt. We never request write scopes.
 */
const DEFAULT_SCOPES =
  "openid fhirUser launch/patient patient/Patient.read patient/Condition.read patient/MedicationRequest.read offline_access";

export interface FhirConfig {
  system: FhirSystem;
  clientId: string;
  /** FHIR base URL, used as the OAuth `aud` and the resource-fetch root. */
  iss: string;
  /** Present only for confidential apps (HTTP Basic on the token request). */
  clientSecret: string | null;
  scopes: string;
}

function trimmed(value: string | undefined): string | null {
  const v = value?.trim();
  return v && v.length > 0 ? v : null;
}

/** True when the given id is a known FHIR-tier system. */
export function isFhirSystem(id: string): id is FhirSystem {
  return (FHIR_SYSTEMS as readonly string[]).includes(id);
}

/**
 * Resolve a system's config from env, or null when it is not fully configured
 * (missing client id or iss). Callers treat null as "configuration required".
 */
export function getFhirConfig(system: FhirSystem): FhirConfig | null {
  const prefix = ENV_PREFIX[system];
  const clientId = trimmed(process.env[`${prefix}_CLIENT_ID`]);
  const iss = trimmed(process.env[`${prefix}_ISS`]);
  if (!clientId || !iss) return null;
  return {
    system,
    clientId,
    iss: iss.replace(/\/+$/, ""),
    clientSecret: trimmed(process.env[`${prefix}_CLIENT_SECRET`]),
    scopes: trimmed(process.env[`${prefix}_SCOPES`]) ?? DEFAULT_SCOPES,
  };
}

/** Whether a FHIR system has usable live credentials configured. */
export function isFhirConfigured(system: FhirSystem): boolean {
  return getFhirConfig(system) !== null;
}
