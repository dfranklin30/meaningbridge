/**
 * Canonical reference data for the professional portal. Kept server-side so the
 * onboarding, intake, and integrations UIs all draw from one source (served via
 * GET /professional/meta) and downstream server code can import the constants
 * directly (e.g. the current consent document version at signing time).
 */

/** Version stamp recorded on every consent signature. Bump when the text changes. */
export const CONSENT_DOCUMENT_VERSION = "2026-07-01";

export const CREDENTIALS: readonly string[] = [
  "MD",
  "DO",
  "PhD",
  "PsyD",
  "LCSW",
  "LMFT",
  "LPC",
  "LMHC",
  "PMHNP",
  "RN",
  "Other",
];

export const SPECIALTY_TAGS: readonly string[] = [
  "Grief & bereavement",
  "Prolonged grief disorder",
  "Trauma & PTSD",
  "Loss of a child",
  "Suicide loss",
  "Perinatal & infant loss",
  "Anticipatory grief",
  "Older adults",
  "Children & adolescents",
  "Couples & family",
  "Faith-based support",
];

export const CAUSE_OF_LOSS_CATEGORIES: readonly string[] = [
  "Illness",
  "Sudden medical event",
  "Accident",
  "Suicide",
  "Homicide",
  "Overdose",
  "Perinatal or infant",
  "Natural causes",
  "Other",
];

export interface IntegrationSystemOption {
  id: string;
  label: string;
  kind: "fhir" | "csv_preset" | "vendor_api";
}

export const INTEGRATION_SYSTEMS: readonly IntegrationSystemOption[] = [
  { id: "epic", label: "Epic", kind: "fhir" },
  { id: "athenahealth", label: "athenahealth", kind: "fhir" },
  { id: "simplepractice", label: "SimplePractice", kind: "csv_preset" },
  { id: "therapynotes", label: "TherapyNotes", kind: "csv_preset" },
  { id: "tebra", label: "Tebra", kind: "csv_preset" },
  { id: "valant", label: "Valant", kind: "vendor_api" },
  { id: "osmind", label: "Osmind", kind: "vendor_api" },
  { id: "icanotes", label: "ICANotes", kind: "vendor_api" },
];

export function professionalMeta() {
  return {
    credentials: [...CREDENTIALS],
    specialtyTags: [...SPECIALTY_TAGS],
    causeOfLossCategories: [...CAUSE_OF_LOSS_CATEGORIES],
    integrationSystems: INTEGRATION_SYSTEMS.map((s) => ({ ...s })),
    consentDocumentVersion: CONSENT_DOCUMENT_VERSION,
  };
}
