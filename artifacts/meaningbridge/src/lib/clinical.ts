/**
 * Client-facing clinical constants — mirror of artifacts/api-server/src/lib/clinical.ts.
 * The server is the source of truth for scoring and tier assignment;
 * this file only carries item wording and the response scale so the UI
 * can render the instrument exactly.
 *
 * Source: Lee & Neimeyer (2022), Death Studies, "Grief Impairment Scale."
 * Public domain for clinical and research use with citation.
 */

export type Tier = "universal" | "targeted" | "clinical";

export const TIER_LABELS: Record<Tier, string> = {
  universal: "Grief Literacy",
  targeted: "Enhanced Support",
  clinical: "Specialist Support",
};

/**
 * Warm, non-clinical paragraph shown to the user after the GIS.
 * Per the spec: "shift from numbers to narratives" — never show the
 * cut-score, never label them.
 */
export const TIER_NARRATIVE: Record<Tier, string> = {
  universal:
    "Most of what you are carrying sounds like the ordinary, unbearable weight of grief. There is nothing wrong with you. This space will keep you company — gentle conversation, room to remember, small daily practices when you want them.",
  targeted:
    "Some of what you are carrying feels heavier than grief usually asks of us. This space will stay close, with gentler prompts and steadier check-ins. When it would help, we will quietly point you toward people, groups, and supports who can be there with you.",
  clinical:
    "Some of what you are carrying deserves the support of a trained human — not because anything is broken, but because the weight of it is real. This space will keep you company, and it will keep returning to one quiet suggestion: a grief therapist can help here in ways we cannot. You are not alone.",
};

export interface GisItem {
  id: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  examples: string;
}

export const GIS_ITEMS: GisItem[] = [
  {
    id: 1,
    prompt: "Experienced problems with thinking because of your grief",
    examples:
      "for example, difficulty with attention or concentration, memory problems, difficulty making decisions.",
  },
  {
    id: 2,
    prompt: "Experienced health problems because of your grief",
    examples:
      "for example, sickness, pain, or discomfort; sleep disturbances; low energy or exhaustion.",
  },
  {
    id: 3,
    prompt: "Engaged in unhealthy activity to cope with your grief",
    examples:
      "for example, alcohol or substance use; unhealthy eating; self-destructive behaviour.",
  },
  {
    id: 4,
    prompt:
      "Unable to fulfill an important responsibility in life (work or school, housekeeping, caring for others) because of your grief",
    examples:
      "for example, absence or poor performance; unkept home; unable to care for those who depend on you.",
  },
  {
    id: 5,
    prompt: "Unable to positively engage with others because of your grief",
    examples:
      "for example, avoiding a significant person, place, or event; conflict with others; being treated hurtfully by others.",
  },
];

export const GIS_SCALE: { value: 0 | 1 | 2 | 3 | 4; label: string; helper: string }[] = [
  { value: 0, label: "Never", helper: "0 days" },
  { value: 1, label: "Seldom", helper: "1 to 3 days" },
  { value: 2, label: "Occasionally", helper: "4 to 15 days" },
  { value: 3, label: "Often", helper: "16 to 29 days" },
  { value: 4, label: "Always", helper: "30 days" },
];

export const GIS_INSTRUCTIONS =
  "Thinking about the past 30 days, please tell us how often you have had difficulty functioning because of your grief. By 'grief' we mean your reactions to your significant loss.";
