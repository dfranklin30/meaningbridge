/**
 * Clinical configuration constants for MeaningBridge.
 *
 * All clinical instruments below are taken from the validated, public-domain sources:
 *   - GIS (Grief Impairment Scale) — Lee & Neimeyer, Death Studies (2022).
 *     Public domain for clinical and research use with citation.
 *   - Public-health pyramid (Universal/Targeted/Clinical) —
 *     Aoun et al. (2012, 2015); Neimeyer / IWG Grief Therapy Workgroup (2025).
 *
 * Validated cut-score: GIS total >= 9 indicates clinically significant
 * functional impairment (79% sensitivity, 74% specificity; AUC ~0.88).
 */

export type Tier = "universal" | "targeted" | "clinical";

export const TIER_LABELS: Record<Tier, string> = {
  universal: "Grief Literacy",
  targeted: "Enhanced Support",
  clinical: "Specialist Support",
};

/** Population shares per Aoun/IWG (configurable). */
export const TIER_SHARES: Record<Tier, number> = {
  universal: 0.6,
  targeted: 0.3,
  clinical: 0.1,
};

export interface GisItem {
  id: number;
  prompt: string;
  examples: string;
  /** Item 3 (self-destructive coping) is safety-linked, never silently scored. */
  safetyLinked?: boolean;
}

/** GIS — Lee & Neimeyer (2022). Exact wording. */
export const GIS_ITEMS: GisItem[] = [
  {
    id: 1,
    prompt: "Experienced problems with thinking because of your grief",
    examples:
      "for example: difficulty with attention or concentration, memory problems, difficulty making decisions.",
  },
  {
    id: 2,
    prompt: "Experienced health problems because of your grief",
    examples:
      "for example: sickness, pain, or discomfort; sleep disturbances; low energy or exhaustion.",
  },
  {
    id: 3,
    prompt: "Engaged in unhealthy activity to cope with your grief",
    examples:
      "for example: alcohol or substance use; unhealthy eating (over- or under-eating); self-destructive behavior.",
    safetyLinked: true,
  },
  {
    id: 4,
    prompt:
      "Unable to fulfill an important responsibility in life (work or school, housekeeping, caring for others) because of your grief",
    examples:
      "for example: absence or poor performance; unkept home; unable to care adequately for those who depend on you.",
  },
  {
    id: 5,
    prompt: "Unable to positively engage with others because of your grief",
    examples:
      "for example: avoiding a significant person, place, or event; conflict with others; being treated hurtfully by others.",
  },
];

/** Days-in-past-30 scale, shared across all GIS items. */
export const GIS_SCALE: { value: number; label: string; helper: string }[] = [
  { value: 0, label: "Never", helper: "0 days" },
  { value: 1, label: "Seldom", helper: "1 to 3 days" },
  { value: 2, label: "Occasionally", helper: "4 to 15 days" },
  { value: 3, label: "Often", helper: "16 to 29 days" },
  { value: 4, label: "Always", helper: "30 days" },
];

export const GIS_INSTRUCTIONS =
  "Using the scale below, please indicate how often, in the past 30 days, you had difficulty functioning because of your grief. By 'grief' we mean your reactions to your significant loss.";

/** Validated cut-score for clinically significant functional impairment. */
export const GIS_CLINICAL_CUTPOINT = 9;

/**
 * Map a total GIS score to a public-health tier.
 * Per PDF spec: 0-4 = Universal, 5-8 = Targeted, >=9 = Clinical.
 */
export function tierFromGisScore(total: number): Tier {
  if (total >= GIS_CLINICAL_CUTPOINT) return "clinical";
  if (total >= 5) return "targeted";
  return "universal";
}

/**
 * Detect safety signals from individual GIS responses.
 * Per PDF Section C/E, two structured triggers escalate regardless of total:
 *   - item 3 (self-destructive coping) scored >= 2
 *   - item 5 (unable to engage with others / withdrawal) scored >= 3
 * "Never 'just scored'" — these route to the safety layer.
 */
export interface GisSafetySignal {
  flag: boolean;
  triggers: ("item3" | "item5")[];
}

export function gisSafetySignal(itemResponses: Record<number, number>): GisSafetySignal {
  const triggers: ("item3" | "item5")[] = [];
  if ((itemResponses[3] ?? 0) >= 2) triggers.push("item3");
  if ((itemResponses[5] ?? 0) >= 3) triggers.push("item5");
  return { flag: triggers.length > 0, triggers };
}

/** Back-compat helper used elsewhere. */
export function gisSafetyFlag(itemResponses: Record<number, number>): boolean {
  return gisSafetySignal(itemResponses).flag;
}
