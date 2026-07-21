import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  SendHorizonal,
  Sparkles,
  ThumbsUp,
  Minus,
  ThumbsDown,
  Heart,
  Stethoscope,
} from "lucide-react";
import { CAPABILITIES } from "./data";

type Role = "seeker" | "professional" | null;

type Landing = { helpful: "yes" | "maybe" | "no" | null; note: string };

/**
 * Per-capability context for the guided walkthrough: a plain-language picture
 * of what the feature looks like in practice, and a warm, in-character reply
 * the companion offers when a sandbox visitor asks about it. No login, no
 * network — this is a self-contained guided tour that gathers feedback as the
 * visitor goes and lets them "ask the companion" about each capability.
 */
const WALKTHROUGH: {
  looksLike: string;
  companionReply: string;
}[] = [
  {
    looksLike:
      "You open a conversation and the companion greets you gently, remembering who you are grieving. You can type or speak, and it listens without rushing.",
    companionReply:
      "I am here whenever the missing feels heavy. You can tell me about them in your own words, and we will go only as far as you want to today.",
  },
  {
    looksLike:
      "A quiet writing space with an optional prompt. When you finish, you may ask for a soft reflection that notices what you are carrying, or keep it entirely private.",
    companionReply:
      "Writing can loosen what is hard to say aloud. If you would like, I can read back what I notice in your words, but only if you ask.",
  },
  {
    looksLike:
      "A continuing bond is tended over time. You revisit the relationship, recall their voice, and let the memory keep shaping who you are becoming.",
    companionReply:
      "The bond does not end. It changes form. We can keep tending it together, so they stay present in the life you are still living.",
  },
  {
    looksLike:
      "A small library of guided practices, breathing, grounding, and remembrance, each taken slowly at your own pace, with nothing to finish.",
    companionReply:
      "When the day is too much, a few slow breaths can be enough. Would it help to try one together, right now?",
  },
  {
    looksLike:
      "Instead of scores, you see a calm narrative of how you have been, written in plain language, so the numbers never stand between you and yourself.",
    companionReply:
      "I will never reduce you to a number. What I can offer is a gentle sense of how you have been carrying this, in words.",
  },
  {
    looksLike:
      "A profile of your loved one, the details you choose to share, so every conversation feels familiar and true to who they were.",
    companionReply:
      "Tell me what made them, them. The small things. It helps me hold them with you the way they deserve.",
  },
  {
    looksLike:
      "A crisis-support affordance sits quietly on every screen, one tap away, so real human help is always within reach.",
    companionReply:
      "If you are ever in danger, a person should be with you, not just me. Support is always one tap away, any hour.",
  },
  {
    looksLike:
      "With your explicit consent, a clinician can gently follow along between sessions, so care continues without you having to start over each time.",
    companionReply:
      "Nothing is shared without your say-so. If you choose, your therapist can walk beside us, so you are never carrying this alone.",
  },
];

const LANDING_OPTIONS: {
  key: "yes" | "maybe" | "no";
  label: string;
  icon: typeof ThumbsUp;
}[] = [
  { key: "yes", label: "This helps", icon: ThumbsUp },
  { key: "maybe", label: "Not sure", icon: Minus },
  { key: "no", label: "Not for me", icon: ThumbsDown },
];

export function GuidedWalkthrough({
  onExit,
  onFinish,
}: {
  onExit: () => void;
  onFinish: (role: Role, summary: string) => void;
}) {
  const total = CAPABILITIES.length;
  const [index, setIndex] = useState(0);
  const [landings, setLandings] = useState<Landing[]>(
    () => CAPABILITIES.map(() => ({ helpful: null, note: "" })),
  );
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<{ q: string; a: string }[]>([]);

  const cap = CAPABILITIES[index];
  const extra = WALKTHROUGH[index] ?? WALKTHROUGH[0];
  const Icon = cap.icon;
  const landing = landings[index];
  const progress = Math.round(((index + 1) / total) * 100);

  const setLanding = (patch: Partial<Landing>) =>
    setLandings((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    setAsked((prev) => [...prev, { q, a: extra.companionReply }]);
    setQuestion("");
  };

  const summary = useMemo(() => {
    const lines: string[] = [];
    landings.forEach((l, i) => {
      if (l.helpful || l.note.trim()) {
        const verdict =
          l.helpful === "yes"
            ? "helps"
            : l.helpful === "maybe"
              ? "unsure"
              : l.helpful === "no"
                ? "not for me"
                : "";
        lines.push(
          `${CAPABILITIES[i].title}: ${verdict}${
            l.note.trim() ? ` — ${l.note.trim()}` : ""
          }`,
        );
      }
    });
    asked.forEach((a) => lines.push(`Asked: ${a.q}`));
    return lines.join("\n");
  }, [landings, asked]);

  const next = () => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setAsked([]);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    }
  };
  const prev = () => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setAsked([]);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    }
  };

  const isLast = index === total - 1;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Leave the tour
          </button>
          <span>
            Step {index + 1} of {total}
          </span>
        </div>
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          {/* Capability */}
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-serif text-3xl leading-tight tracking-tight">
              {cap.title}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {cap.body}
            </p>
          </div>

          {/* What it looks like */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
              What this looks like
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {extra.looksLike}
            </p>
          </div>

          {/* Feedback as you go */}
          <div className="rounded-2xl border border-border bg-background/60 p-5 space-y-4">
            <p className="text-sm font-medium">How does this land for you?</p>
            <div className="grid grid-cols-3 gap-2">
              {LANDING_OPTIONS.map((opt) => {
                const active = landing.helpful === opt.key;
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setLanding({ helpful: opt.key })}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <OptIcon className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={landing.note}
              onChange={(e) => setLanding({ note: e.target.value })}
              placeholder="Anything you would want here? (optional)"
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>

          {/* Ask the companion */}
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">Ask the companion about this</p>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="For example: how would this actually help me?"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={ask}
                disabled={!question.trim()}
                aria-label="Ask"
                className="shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                <SendHorizonal className="w-4 h-4" />
              </button>
            </div>
            {asked.length > 0 && (
              <div className="space-y-3 pt-1">
                {asked.map((a, i) => (
                  <div key={i} className="space-y-2">
                    <p className="text-sm text-foreground/80">
                      <span className="text-muted-foreground">You asked: </span>
                      {a.q}
                    </p>
                    <div className="rounded-xl bg-card border border-border px-3 py-2.5 text-sm leading-relaxed text-foreground/90">
                      {a.a}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  In the full experience, the companion replies to you
                  personally, in conversation, and can speak aloud.
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={() => onFinish(null, summary)}
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Finish and share feedback
                <Check className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Doorways into the real experience */}
      {isLast && (
        <div className="mt-10 grid sm:grid-cols-2 gap-3">
          <Link
            href="/grieving"
            className="group rounded-2xl border border-primary/30 bg-card p-5 hover:border-primary/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <p className="font-serif text-lg">Enter as someone grieving</p>
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary">
              Begin gently
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
          <Link
            href="/pro"
            className="group rounded-2xl border border-brand-navy/25 bg-card p-5 hover:border-brand-navy/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-brand-navy/10 flex items-center justify-center mb-3">
              <Stethoscope className="w-5 h-5 text-brand-navy" />
            </div>
            <p className="font-serif text-lg">Enter as a professional</p>
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-navy">
              Clinicians &amp; care teams
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
