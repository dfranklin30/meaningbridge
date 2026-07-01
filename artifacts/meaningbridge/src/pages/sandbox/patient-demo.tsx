import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  PenLine,
  Wind,
  LineChart,
  Heart,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  COMPANION_TURNS,
  JOURNAL_PROMPT,
  JOURNAL_SAMPLE,
  JOURNAL_REFLECTION,
} from "./data";

type TabId = "companion" | "journal" | "practice" | "picture" | "lovedone";

const TABS: { id: TabId; label: string; icon: typeof MessageCircle }[] = [
  { id: "companion", label: "Companion", icon: MessageCircle },
  { id: "journal", label: "Journal", icon: PenLine },
  { id: "practice", label: "A practice", icon: Wind },
  { id: "picture", label: "How you are", icon: LineChart },
  { id: "lovedone", label: "Your loved one", icon: Heart },
];

export function PatientDemo({
  onBack,
  onSurvey,
}: {
  onBack: () => void;
  onSurvey: () => void;
}) {
  const [tab, setTab] = useState<TabId>("companion");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to the entrance
        </button>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          A gentle walkthrough, with sample content
        </p>
        <h1 className="font-serif text-3xl md:text-4xl leading-tight">
          This is what it feels like to be met here.
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Move through each part at your own pace. Nothing here is recorded, and
          the words are only examples of how MeaningBridge companions you.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/70 border-border text-foreground hover:border-primary/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
        >
          {tab === "companion" && <CompanionPanel />}
          {tab === "journal" && <JournalPanel />}
          {tab === "practice" && <PracticePanel />}
          {tab === "picture" && <PicturePanel />}
          {tab === "lovedone" && <LovedOnePanel />}
        </motion.div>
      </AnimatePresence>

      <div className="rounded-2xl border border-border bg-card/70 p-6 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          When you are ready, we would be grateful to hear how this felt for you.
        </p>
        <button
          type="button"
          onClick={onSurvey}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Share your experience
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function CompanionPanel() {
  const first = COMPANION_TURNS[0]!;
  const [turnIndex, setTurnIndex] = useState(0);
  const [messages, setMessages] = useState<
    { role: "companion" | "you"; text: string }[]
  >([{ role: "companion", text: first.companion }]);

  const current = COMPANION_TURNS[turnIndex];
  const done = !current || current.replies.length === 0;

  const pick = (reply: string) => {
    const next = COMPANION_TURNS[turnIndex + 1];
    setMessages((m) => [
      ...m,
      { role: "you", text: reply },
      ...(next ? [{ role: "companion" as const, text: next.companion }] : []),
    ]);
    setTurnIndex((i) => i + 1);
  };

  const restart = () => {
    setTurnIndex(0);
    setMessages([{ role: "companion", text: first.companion }]);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div className="space-y-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={m.role === "you" ? "flex justify-end" : "flex justify-start"}
          >
            <p
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "you"
                  ? "bg-primary/10 text-foreground rounded-br-sm"
                  : "bg-muted/60 text-foreground/90 rounded-bl-sm"
              }`}
            >
              {m.text}
            </p>
          </motion.div>
        ))}
      </div>

      {!done && current ? (
        <div className="space-y-2 pt-2 border-t border-border/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            A few ways you might answer
          </p>
          <div className="flex flex-col gap-2">
            {current.replies.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => pick(r)}
                className="text-left text-sm px-4 py-3 rounded-xl border border-border bg-background/70 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            The companion stays with you for as long as you need.
          </p>
          <button
            type="button"
            onClick={restart}
            className="text-sm text-primary hover:underline shrink-0"
          >
            Begin again
          </button>
        </div>
      )}
    </div>
  );
}

function JournalPanel() {
  const [text, setText] = useState("");
  const [reflected, setReflected] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Today's gentle prompt
        </p>
        <p className="font-serif text-lg leading-snug">{JOURNAL_PROMPT}</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (reflected) setReflected(false);
        }}
        rows={4}
        placeholder={JOURNAL_SAMPLE}
        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-primary/50"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!text.trim()) setText(JOURNAL_SAMPLE);
            setReflected(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <PenLine className="w-3.5 h-3.5" />
          Invite a reflection
        </button>
        <p className="text-xs text-muted-foreground">
          A reflection is always optional. Your writing is yours first.
        </p>
      </div>

      <AnimatePresence>
        {reflected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-primary/80">
                A reflection, offered gently
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {JOURNAL_REFLECTION}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PRACTICE_STEPS = [
  "Let your shoulders soften, and your breath find its own slow rhythm.",
  "Bring to mind one thing that is steady around you right now.",
  "If it feels right, let the person you are missing be here too, quietly.",
  "Stay as long as you like. There is nowhere you need to be.",
];

function PracticePanel() {
  const [step, setStep] = useState(0);
  const active = PRACTICE_STEPS[step]!;
  const isLast = step >= PRACTICE_STEPS.length - 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          A short grounding practice
        </p>
        <p className="font-serif text-lg leading-snug">
          Resting with a steady breath
        </p>
      </div>

      <div className="relative flex items-center justify-center py-8">
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-40 h-40 rounded-full bg-primary/15 blur-2xl"
        />
        <div className="relative w-28 h-28 rounded-full border border-primary/30 bg-background/60 flex items-center justify-center text-center px-4">
          <span className="text-xs text-muted-foreground">breathe in, breathe out</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="text-center text-base leading-relaxed text-foreground/90 min-h-[3rem]"
        >
          {active}
        </motion.p>
      </AnimatePresence>

      <div className="flex justify-center">
        {isLast ? (
          <button
            type="button"
            onClick={() => setStep(0)}
            className="text-sm text-primary hover:underline"
          >
            Begin again
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-border text-sm hover:border-primary/50 transition-colors"
          >
            When you are ready
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function PicturePanel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          How you are, in words
        </p>
        <p className="font-serif text-lg leading-snug">
          Right now, your grief seems to be asking for steady, caring support.
        </p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        MeaningBridge never shows you a score. Instead, it listens over time and
        reflects back what it notices, softly and in plain language, so you can
        decide what you need.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <NarrativeCard
          label="Rest"
          body="Your mornings have felt harder than your evenings lately. Sleep is beginning to steady."
        />
        <NarrativeCard
          label="Connection"
          body="You have been reaching toward a few close people, even on the quieter days."
        />
        <NarrativeCard
          label="Meaning"
          body="You are returning to the garden and to small rituals that keep David near."
        />
        <NarrativeCard
          label="Safety"
          body="Nothing here is a cause for worry. Support is always one tap away if you need it."
        />
      </div>
    </div>
  );
}

function NarrativeCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4 space-y-1.5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

function LovedOnePanel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          A profile of your loved one, sample content
        </p>
        <p className="font-serif text-2xl leading-snug">David</p>
        <p className="text-sm text-muted-foreground">Husband, and lifelong gardener</p>
      </div>
      <div className="space-y-4">
        <Detail label="What you loved most">
          The way he hummed while he worked, and how he never rushed a morning.
        </Detail>
        <Detail label="A memory that keeps him close">
          The two of you planting the first tomatoes the spring after you married.
        </Detail>
        <Detail label="Something you still want him to know">
          That the garden he started is blooming, and that you are tending it.
        </Detail>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
        The details you choose to share stay with you, and they shape how the
        companion speaks, so every conversation feels like it truly knows who you
        are remembering.
      </p>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground/90 italic border-l-2 border-border pl-3">
        {children}
      </p>
    </div>
  );
}
