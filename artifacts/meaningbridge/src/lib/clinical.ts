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
  { id: 16, prompt: "I've lost my innocence" },
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

/* ------------------------------------------------------------------ *
 * IDWL — Inventory of Daily Widowed Life (Caserta & Lund).
 * 22 items, 1-4, plus companion items. Public domain with citation.
 * For those who have lost a spouse or partner. Reflective (Dual Process).
 * ------------------------------------------------------------------ */

export const IDWL_INSTRUCTIONS =
  "Below are activities, tasks, and issues that people who have lost a spouse or partner sometimes confront in daily life. For each one, notice how frequently you have done it during the past week.";

export const IDWL_SCALE: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: "Rarely or not at all" },
  { value: 2, label: "Once in a while" },
  { value: 3, label: "Fairly often" },
  { value: 4, label: "Almost always" },
];

/** IDWL items in order (id 1-22). Items 1-11 loss-oriented, 12-22 restoration. */
export const IDWL_ITEMS: { id: number; prompt: string }[] = [
  { id: 1, prompt: "Thinking about how much I miss my spouse/partner" },
  { id: 2, prompt: "Thinking about the circumstances or events associated with my spouse/partner's death" },
  { id: 3, prompt: "Yearning for my spouse/partner" },
  { id: 4, prompt: "Looking at old photographs and other reminders of my spouse/partner" },
  { id: 5, prompt: "Imagining how my spouse/partner would react to my behavior" },
  { id: 6, prompt: "Imagining how my spouse/partner would react to the way I handled tasks or problems I faced" },
  { id: 7, prompt: "Crying or feeling sad about the death of my spouse/partner" },
  { id: 8, prompt: "Being preoccupied with my situation" },
  { id: 9, prompt: "Engaging in fond or happy memories about my spouse/partner" },
  { id: 10, prompt: "Feeling a bond with my spouse/partner" },
  { id: 11, prompt: "Dealing with feeling lonely" },
  { id: 12, prompt: "Visiting or doing things with others" },
  { id: 13, prompt: "Finding ways to keep busy or occupied" },
  { id: 14, prompt: "Dealing with financial matters" },
  { id: 15, prompt: "Engaging in leisure activities (hobbies, recreation, physical activity, etc.)" },
  { id: 16, prompt: "Attending to my own health-related needs" },
  { id: 17, prompt: "Engaging in employment or volunteer work" },
  { id: 18, prompt: "Watching TV, listening to music, listening to the radio, reading" },
  { id: 19, prompt: "Attending to legal, insurance or property matters" },
  { id: 20, prompt: "Attending to the maintenance of my household or automobile" },
  { id: 21, prompt: "Focusing on other things besides grieving" },
  { id: 22, prompt: "Learning to do new things" },
];

export const IDWL_LOSS_ITEM_IDS = Array.from({ length: 11 }, (_, i) => i + 1);
export const IDWL_RESTORATION_ITEM_IDS = Array.from({ length: 11 }, (_, i) => i + 12);

/** Companion items C1, C2, C4 (1-5) and C3 (a five-option frequency, index 0-4). */
export const IDWL_COMPANION_INTRO =
  "Sometimes when people adjust to the loss of a spouse or partner they focus their attention on two different kinds of issues. One is dealing with grief, emotions, and feelings; the other is dealing with new responsibilities and activities, and having time away from grieving. These last questions ask how you have moved between the two this past week.";

export const IDWL_C1 = {
  key: "awarenessLoss" as const,
  prompt:
    "During the past week, to what extent have you focused your attention on dealing with your grief, emotions and feelings?",
  low: "Very little",
  high: "A great deal",
};
export const IDWL_C2 = {
  key: "awarenessRestoration" as const,
  prompt:
    "During the past week, to what extent have you focused your attention on dealing with new responsibilities and activities, and/or having time away from grieving?",
  low: "Very little",
  high: "A great deal",
};
export const IDWL_C4 = {
  key: "control" as const,
  prompt:
    "If you have given attention to both of these issues at least once this past week, were you able to go back and forth as you wanted to?",
  low: "I have no control",
  high: "Full control over this",
};

/** C3 — how often you have gone back and forth (index 0-4). */
export const IDWL_C3_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "I have focused on only one issue, not both" },
  { value: 1, label: "Gone back and forth once or twice this past week" },
  { value: 2, label: "Gone back and forth several times this week" },
  { value: 3, label: "Gone back and forth a few times each day" },
  { value: 4, label: "Gone back and forth several times each day" },
];

/** C5 — the "intent" reflection is carried into the journal rather than scored. */
export const IDWL_C5_PROMPT =
  "When I move back and forth between grieving and the rest of life, I usually do it because I…";

/** A warm reading of the oscillation balance (restoration minus loss, -33..33). */
export function idwlBalanceNarrative(balance: number): { title: string; body: string } {
  if (balance <= -8) {
    return {
      title: "This week leaned toward grief",
      body: "Much of your attention has been with the loss itself — the missing, the remembering, the ache. That is not a wrong place to be. Grief needs its own time, and leaning in is part of how it moves.",
    };
  }
  if (balance >= 8) {
    return {
      title: "This week leaned toward daily life",
      body: "Much of your attention has been on the tasks and rhythms of daily life — keeping things going, tending to what is in front of you. Restoration is grief work too. It is also okay to let the loss back in when it asks.",
    };
  }
  return {
    title: "This week moved between both",
    body: "Your attention has moved between grieving and the rest of life. That back-and-forth — leaning into the loss, then stepping toward daily living — is exactly how the dual process of grieving tends to work.",
  };
}
