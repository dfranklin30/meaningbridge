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

/* ------------------------------------------------------------------ *
 * GMRI — Grief & Meaning Reconstruction Inventory (Neimeyer).
 * 29 items, 1-5. Public domain with citation. Reflective only.
 * Wording mirrors Appendix 9.1 exactly; scoring lives on the server.
 * ------------------------------------------------------------------ */

export const GMRI_INSTRUCTIONS =
  "These statements refer to thoughts, beliefs, feelings, and meanings some bereaved people experience following a loss. There are no right answers. For each one, notice how true it has felt for you in the past week.";

export const GMRI_SCALE: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neither agree nor disagree" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

/** GMRI statements in order (id 1-29), exactly as printed. */
export const GMRI_ITEMS: { id: number; prompt: string }[] = [
  { id: 1, prompt: "The time I spent with my loved one was a blessing" },
  { id: 2, prompt: "I do not see any good that has come from this loss" },
  { id: 3, prompt: "Since this loss, I'm more self-reflective" },
  { id: 4, prompt: "I value family more" },
  { id: 5, prompt: "I will see my loved one again" },
  { id: 6, prompt: "Since this loss, I find myself more alone and isolated" },
  { id: 7, prompt: "I've been able to make sense of this loss" },
  { id: 8, prompt: "Since this loss, I'm a stronger person" },
  { id: 9, prompt: "I can't understand this loss" },
  { id: 10, prompt: "I was prepared for my loved one to die" },
  { id: 11, prompt: "My loved one was a good person; he/she lived a good life" },
  { id: 12, prompt: "I value and appreciate life more" },
  { id: 13, prompt: "Since this loss, I've changed my lifestyle for the better" },
  { id: 14, prompt: "Memories of my loved one bring me a sense of peace and solace" },
  { id: 15, prompt: "This death brought my loved one peace" },
  { id: 16, prompt: "I've lost my innocence. I am less naive about life as a result of this loss." },
  { id: 17, prompt: "This death ended my loved one's suffering" },
  { id: 18, prompt: "I miss my loved one" },
  { id: 19, prompt: "Since this loss, I make more effort to help others" },
  { id: 20, prompt: "I feel empty and lost" },
  { id: 21, prompt: "I cherish the memories of my loved one" },
  { id: 22, prompt: "Since this loss, I value friendship and social support more" },
  { id: 23, prompt: "My loved one was prepared to die" },
  { id: 24, prompt: "Whenever I can, I seize the day. I live life to the fullest" },
  { id: 25, prompt: "Since this loss, I'm a more responsible person" },
  { id: 26, prompt: "I believe my loved one is in a better place" },
  { id: 27, prompt: "I feel pain from regrets I have in regard to this loss" },
  { id: 28, prompt: "I've come to understand that life is short and it gives us no guarantees" },
  { id: 29, prompt: "Since this loss, I've pursued new avenues of knowledge and learning" },
];

export type GmriFactorKey =
  | "continuingBonds"
  | "personalGrowth"
  | "senseOfPeace"
  | "emptiness"
  | "valuingLife";

export const GMRI_FACTOR_ORDER: GmriFactorKey[] = [
  "continuingBonds",
  "personalGrowth",
  "senseOfPeace",
  "emptiness",
  "valuingLife",
];

/**
 * Per-factor wording and narratives. All factors are oriented so a higher
 * mean reads "healthier" (emptiness is reverse-scored on the server, so a
 * high emptiness score here means a person feels *less* empty).
 */
export const GMRI_FACTORS: Record<
  GmriFactorKey,
  { label: string; short: string; high: string; mid: string; low: string }
> = {
  continuingBonds: {
    label: "Continuing bond",
    short: "The sense of an ongoing, sustaining connection with your loved one.",
    high: "Your bond with the one you are remembering feels alive and sustaining. That connection is not something to move past — it is part of how love keeps its shape.",
    mid: "The connection with your loved one is present, and some days it feels closer than others. There is no pace you are meant to keep.",
    low: "The felt connection with your loved one may be hard to reach right now. That distance is common, and it does not mean the bond is gone.",
  },
  personalGrowth: {
    label: "Personal growth",
    short: "Ways you may have grown or changed since the loss.",
    high: "You are noticing real growth alongside the grief — strength, reflection, new intentions. Growth and sorrow can live in the same breath.",
    mid: "Some growth is emerging, quietly. It rarely arrives all at once, and it does not cancel the loss.",
    low: "Growth may feel far away right now, and that is entirely understandable. Early grief asks for tending, not transformation.",
  },
  senseOfPeace: {
    label: "Sense of peace",
    short: "How much this loss has begun to make sense or find some peace.",
    high: "Some sense of peace or understanding has begun to settle around this loss. That is hard-won, and it is yours.",
    mid: "Peace comes and goes. Some parts of this loss make a kind of sense; others may not yet, and both are allowed.",
    low: "This loss may still feel senseless, and peace may feel out of reach. Meaning often returns slowly, in small pieces, and it cannot be forced.",
  },
  emptiness: {
    label: "Room to breathe",
    short: "The weight of emptiness, isolation, and regret you may be carrying.",
    high: "The heavier feelings of emptiness and isolation seem to be resting more lightly on you right now. That steadier ground is worth noticing.",
    mid: "Emptiness and loneliness move through some days more than others. On the harder days, be gentle with what you ask of yourself.",
    low: "A good deal of emptiness, loneliness, or regret seems to be with you right now. That weight is real, and you do not have to carry it alone.",
  },
  valuingLife: {
    label: "Valuing life",
    short: "A renewed sense of the preciousness of life.",
    high: "You are holding a renewed sense of how precious life is. Letting that live beside the grief is its own kind of remembering.",
    mid: "A sense of life's value is present in glimpses. It tends to deepen in its own time.",
    low: "The sense that life is precious may feel dimmed right now. That is a natural part of grief's early weather.",
  },
};

/** Pick the narrative band for a factor mean on the 1-5 scale. */
export function gmriBand(mean: number): "high" | "mid" | "low" {
  if (mean >= 3.5) return "high";
  if (mean <= 2.5) return "low";
  return "mid";
}
