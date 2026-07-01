import { db, practicesTable, pool } from "@workspace/db";
import type { BreathPhase } from "@workspace/db";

type PracticeSeed = {
  slug: string;
  title: string;
  category: string;
  durationMinutes: number;
  summary: string;
  steps: string[];
  breathPattern: BreathPhase[] | null;
};

// Breath pacer conventions (see practices/player.tsx + editor.tsx):
// inhale expands the circle (scale ~1.3), holds keep the reached scale,
// exhale contracts it (scale ~0.7). Only breathwork practices get a pattern;
// everything else stays null so no pacer is shown.

// Box Breath: in 4 / hold 4 / out 4 / hold 4 — the canonical square rhythm.
const BOX_BREATH: BreathPhase[] = [
  { label: "Inhale", seconds: 4, scale: 1.3 },
  { label: "Hold", seconds: 4, scale: 1.3 },
  { label: "Exhale", seconds: 4, scale: 0.7 },
  { label: "Hold", seconds: 4, scale: 0.7 },
];

// 5-4-3-2-1 grounding is a sensory practice for acute distress, so it gets a
// gentle extended-exhale rhythm (in 4 / out 6) that calms the nervous system
// without demanding breath holds.
const EXTENDED_EXHALE: BreathPhase[] = [
  { label: "Inhale", seconds: 4, scale: 1.3 },
  { label: "Exhale", seconds: 6, scale: 0.7 },
];

const PRACTICES: PracticeSeed[] = [
  {
    slug: "box-breath",
    title: "Box Breath",
    category: "breathwork",
    durationMinutes: 4,
    summary:
      "A four-count breathing pattern to settle the nervous system when grief swells.",
    steps: [
      "Sit somewhere you will not be disturbed.",
      "Inhale slowly through the nose for a count of four.",
      "Hold the breath for a count of four.",
      "Exhale through the mouth for a count of four.",
      "Hold empty for a count of four.",
      "Repeat for four to six rounds, lengthening the count if it feels right.",
    ],
    breathPattern: BOX_BREATH,
  },
  {
    slug: "candle-meditation",
    title: "Candle Meditation for the One You Love",
    category: "meditation",
    durationMinutes: 10,
    summary:
      "A short sitting practice that uses a single flame as a focal point for remembering.",
    steps: [
      "Light a candle in a quiet place.",
      "Place a small object that belonged to them within reach if you have one.",
      "Soften your gaze toward the flame.",
      "Inhale and silently say their name.",
      "Exhale and notice what arises — image, ache, gratitude, nothing.",
      "If thoughts pull you away, return to the flame without judgment.",
      "When you are ready, place a hand on your heart and blow the candle out slowly.",
    ],
    breathPattern: null,
  },
  {
    slug: "letter-to-them",
    title: "A Letter You Will Not Send",
    category: "art",
    durationMinutes: 20,
    summary: "An expressive writing practice rooted in continuing bonds work.",
    steps: [
      "Take a piece of paper and a pen you like.",
      "Write Dear at the top, followed by their name.",
      "Tell them one thing you have not been able to say out loud.",
      "Tell them one thing you have learned since they left.",
      "Ask them one question you wish you could ask.",
      "Sit with the page for a moment when you are done.",
      "Choose what to do with it: keep it, fold it away, or release it in a small ritual.",
    ],
    breathPattern: null,
  },
  {
    slug: "evening-ritual",
    title: "Evening Remembrance Ritual",
    category: "ritual",
    durationMinutes: 5,
    summary: "A small repeatable ritual for closing the day with intention.",
    steps: [
      "Choose a consistent time near the end of your day.",
      "Light a small candle or pour a glass of water.",
      "Speak their name aloud.",
      "Name one moment from today they would have wanted to hear about.",
      "Pause for one slow breath.",
      "Extinguish the candle or take a sip of the water and rest.",
    ],
    breathPattern: null,
  },
  {
    slug: "grounding-5-4-3-2-1",
    title: "5-4-3-2-1 Grounding",
    category: "breathwork",
    durationMinutes: 3,
    summary: "A sensory grounding practice for moments of acute distress.",
    steps: [
      "Plant both feet on the floor.",
      "Name five things you can see.",
      "Name four things you can feel.",
      "Name three things you can hear.",
      "Name two things you can smell.",
      "Name one thing you can taste.",
      "Take one slow breath and notice you are here.",
    ],
    breathPattern: EXTENDED_EXHALE,
  },
  {
    slug: "values-reflection",
    title: "What They Carried",
    category: "reflection",
    durationMinutes: 12,
    summary: "A Neimeyer-inspired reflection on values that endure.",
    steps: [
      "Bring to mind the person you are grieving.",
      "Write down three values you saw them live by.",
      "For each value, write a single sentence about a time they showed it.",
      "Choose one of the three to carry forward this week.",
      "Decide on one small act that would honor that value.",
      "Note when you will do it.",
    ],
    breathPattern: null,
  },
];

async function main() {
  for (const p of PRACTICES) {
    await db
      .insert(practicesTable)
      .values({
        slug: p.slug,
        title: p.title,
        category: p.category,
        durationMinutes: p.durationMinutes,
        summary: p.summary,
        steps: p.steps,
        breathPattern: p.breathPattern,
      })
      .onConflictDoUpdate({
        target: practicesTable.slug,
        set: {
          title: p.title,
          category: p.category,
          durationMinutes: p.durationMinutes,
          summary: p.summary,
          steps: p.steps,
          breathPattern: p.breathPattern,
        },
      });
    console.log(
      `seeded ${p.slug}${p.breathPattern ? ` (pacer: ${p.breathPattern.map((ph) => `${ph.label} ${ph.seconds}s`).join(" / ")})` : ""}`,
    );
  }
  console.log(`\nSeeded ${PRACTICES.length} practices.`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
