import type { LucideIcon } from "lucide-react";
import {
  MessageCircle,
  PenLine,
  Users,
  Wind,
  LineChart,
  Heart,
  LifeBuoy,
  Stethoscope,
} from "lucide-react";

export interface Capability {
  icon: LucideIcon;
  title: string;
  body: string;
}

/**
 * The capabilities MeaningBridge offers, shown on entry and mirrored by the
 * feedback survey. Grounded in Dr. Robert Neimeyer's meaning reconstruction
 * and continuing bonds work.
 */
export const CAPABILITIES: Capability[] = [
  {
    icon: MessageCircle,
    title: "A companion who understands grief",
    body: "Conversations grounded in Dr. Robert Neimeyer's meaning reconstruction and continuing bonds approach.",
  },
  {
    icon: PenLine,
    title: "An interactive journal",
    body: "Write freely and, only if you wish, receive a gentle reflection that helps you notice what you are carrying.",
  },
  {
    icon: Users,
    title: "Continuing bonds conversations",
    body: "Tend an ongoing relationship with the person you lost, shaped by your own memories of them.",
  },
  {
    icon: Wind,
    title: "Self-guided practices",
    body: "Quiet exercises for grounding, remembrance, and rest, taken at your own pace.",
  },
  {
    icon: LineChart,
    title: "A picture drawn in words, not numbers",
    body: "A calm read on how you are doing, written as narrative rather than scores.",
  },
  {
    icon: Heart,
    title: "A profile of your loved one",
    body: "The details you choose to share shape every conversation, so it feels familiar and true.",
  },
  {
    icon: LifeBuoy,
    title: "Crisis safety, always near",
    body: "Support resources are woven through every screen, one quiet tap away.",
  },
  {
    icon: Stethoscope,
    title: "A bridge to your therapist",
    body: "With your consent, a clinician can gently follow along between sessions.",
  },
];

export interface CompanionTurn {
  companion: string;
  replies: string[];
}

/**
 * A scripted sample conversation. The companion voice uses plain language and
 * no symbols, in keeping with the product's tone.
 */
export const COMPANION_TURNS: CompanionTurn[] = [
  {
    companion:
      "I am glad you are here. There is no right way to begin. If it helps, you could tell me who you are missing today.",
    replies: [
      "I lost my husband David eight months ago.",
      "I am not sure I can put it into words yet.",
    ],
  },
  {
    companion:
      "Thank you for telling me about David. Eight months can feel like both a long time and no time at all. When he comes to mind today, what is closest to the surface?",
    replies: [
      "I keep reaching for him in the mornings.",
      "I feel guilty that some days are lighter.",
    ],
  },
  {
    companion:
      "Those mornings sound tender. Reaching for someone is a kind of remembering, and it shows how present he still is for you. If it feels right, what is one thing you wish you could tell him now?",
    replies: [
      "I would tell him the garden finally bloomed.",
      "I would tell him that I am trying.",
    ],
  },
  {
    companion:
      "That is a beautiful thing to carry to him. Noticing the garden, and letting him be part of it, is one way a bond quietly continues. We can stay with this as long as you like, or simply rest here for a while.",
    replies: [],
  },
];

export const JOURNAL_PROMPT =
  "What is one small, ordinary moment with them that still feels like home?";

export const JOURNAL_SAMPLE =
  "Some mornings I still make two cups of coffee before I remember. Then I sit with both of them for a little while before I pour one out.";

export const JOURNAL_REFLECTION =
  "There is so much love held in that small habit. Making the second cup sounds like a way of keeping the morning company, and keeping him close. You may be noticing that you are not only remembering a person, you are tending a relationship that is still yours. If it feels right, you could write about what those quiet mornings have taught you about the two of you.";
