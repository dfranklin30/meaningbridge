import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MessageCircle,
  PenLine,
  Wind,
  LineChart,
  Heart,
  LifeBuoy,
  Sparkles,
  MessagesSquare,
  Users,
  ArrowLeft,
  ArrowRight,
  X,
  Phone,
} from "lucide-react";
import {
  COMPANION_TURNS,
  JOURNAL_PROMPT,
  JOURNAL_SAMPLE,
  JOURNAL_REFLECTION,
} from "./data";

type SceneId =
  | "companion"
  | "journal"
  | "practice"
  | "picture"
  | "lovedone"
  | "community"
  | "crisis"
  | "recap";

interface Scene {
  id: SceneId;
  label: string;
  icon: typeof MessageCircle;
  /** HSL triple, e.g. "176 55% 34%" — assigned to the --scene CSS variable. */
  accent: string;
  eyebrow: string;
  title: string;
}

// Each scene carries its own accent, so the walkthrough feels alive
// scene-to-scene while still harmonizing with the navy/teal brand.
const SCENES: Scene[] = [
  {
    id: "companion",
    label: "Companion",
    icon: MessageCircle,
    accent: "176 58% 32%",
    eyebrow: "Your AI companion",
    title: "A companion who stays with you.",
  },
  {
    id: "journal",
    label: "Journal",
    icon: PenLine,
    accent: "34 62% 34%",
    eyebrow: "Guided journaling",
    title: "Write at your own pace, with a gentle prompt.",
  },
  {
    id: "practice",
    label: "A practice",
    icon: Wind,
    accent: "158 42% 30%",
    eyebrow: "Self-guided practices",
    title: "A few quiet minutes to steady yourself.",
  },
  {
    id: "picture",
    label: "How you are",
    icon: LineChart,
    accent: "250 34% 46%",
    eyebrow: "Insights over time",
    title: "How you are, in plain language — never a score.",
  },
  {
    id: "lovedone",
    label: "Your loved one",
    icon: Heart,
    accent: "348 44% 44%",
    eyebrow: "A profile of your loved one",
    title: "Keep them close, in their own words.",
  },
  {
    id: "community",
    label: "Community",
    icon: MessagesSquare,
    accent: "199 46% 36%",
    eyebrow: "A community that understands",
    title: "Others who understand, when you want them.",
  },
  {
    id: "crisis",
    label: "Crisis support",
    icon: LifeBuoy,
    accent: "209 54% 34%",
    eyebrow: "Crisis support, always near",
    title: "If things ever feel like too much.",
  },
  {
    id: "recap",
    label: "Recap",
    icon: Sparkles,
    accent: "176 58% 30%",
    eyebrow: "Everything, together",
    title: "This is MeaningBridge.",
  },
];

export function PatientDemo({
  onBack,
  onSurvey,
}: {
  onBack: () => void;
  onSurvey: () => void;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const scene = SCENES[index]!;
  const total = SCENES.length;
  const isRecap = scene.id === "recap";
  const touchStartX = useRef<number | null>(null);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(total - 1, i));
    setIndex(clamped);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // Keyboard arrow navigation, but never while the visitor is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (Math.abs(dx) > 56) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      };

  return (
    <div
      className="max-w-3xl mx-auto space-y-8"
      style={{ ["--scene" as string]: scene.accent } as React.CSSProperties}
    >
      {/* Top bar: leave the tour + step counter */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Leave the tour
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {isRecap ? "The whole picture" : `Step ${index + 1} of ${total - 1}`}
        </p>
      </div>

      {/* Progress dots — clickable, themed to each scene */}
      <nav aria-label="Walkthrough progress" className="flex items-center justify-center gap-2">
        {SCENES.map((s, i) => {
          const active = i === index;
          const done = i < index;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${s.label}`}
              aria-current={active ? "step" : undefined}
              className="group py-2"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-500 ${
                  active ? "w-9" : "w-2 bg-border group-hover:bg-muted-foreground/40"
                }`}
                style={
                  active
                    ? { backgroundColor: `hsl(${s.accent})` }
                    : done
                      ? { backgroundColor: `hsl(${s.accent} / 0.45)` }
                      : undefined
                }
              />
            </button>
          );
        })}
      </nav>

      {/* Scene header */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`head-${scene.id}`}
          {...fade}
          transition={{ duration: reduce ? 0.2 : 0.4 }}
          className="space-y-2 text-center"
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-full"
              style={{
                backgroundColor: `hsl(${scene.accent} / 0.12)`,
                color: `hsl(${scene.accent})`,
              }}
            >
              <scene.icon className="w-4 h-4" />
            </span>
            <p
              className="text-xs uppercase tracking-[0.2em] font-medium"
              style={{ color: `hsl(${scene.accent})` }}
            >
              {scene.eyebrow}
            </p>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight">
            {scene.title}
          </h1>
        </motion.div>
      </AnimatePresence>

      {/* Scene body */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <AnimatePresence mode="wait">
          <motion.div
            key={scene.id}
            {...fade}
            transition={{ duration: reduce ? 0.2 : 0.4 }}
          >
            {scene.id === "companion" && <CompanionPanel reduce={!!reduce} />}
            {scene.id === "journal" && <JournalPanel reduce={!!reduce} />}
            {scene.id === "practice" && <PracticePanel reduce={!!reduce} />}
            {scene.id === "picture" && <PicturePanel />}
            {scene.id === "lovedone" && <LovedOnePanel />}
            {scene.id === "community" && <CommunityPanel />}
            {scene.id === "crisis" && <CrisisPanel />}
            {scene.id === "recap" && (
              <RecapPanel onSurvey={onSurvey} onReplay={() => goTo(0)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Next / Back controls */}
      {!isRecap && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm text-foreground hover:border-foreground/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: `hsl(${scene.accent})` }}
          >
            {index === total - 2 ? "See it all together" : "Next"}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}

function CompanionPanel({ reduce }: { reduce: boolean }) {
  const first = COMPANION_TURNS[0]!;
  const [turnIndex, setTurnIndex] = useState(0);
  const [messages, setMessages] = useState<
    { role: "companion" | "you"; text: string }[]
  >([{ role: "companion", text: first.companion }]);

  const current = COMPANION_TURNS[turnIndex];
  const done = !current || current.replies.length === 0;

  const pick = (reply: string) => {
    const nextTurn = COMPANION_TURNS[turnIndex + 1];
    setMessages((m) => [
      ...m,
      { role: "you", text: reply },
      ...(nextTurn ? [{ role: "companion" as const, text: nextTurn.companion }] : []),
    ]);
    setTurnIndex((i) => i + 1);
  };

  const restart = () => {
    setTurnIndex(0);
    setMessages([{ role: "companion", text: first.companion }]);
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-8 space-y-6">
      <div className="space-y-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={reduce ? undefined : { opacity: 0, y: 6 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={m.role === "you" ? "flex justify-end" : "flex justify-start"}
          >
            <p
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={
                m.role === "you"
                  ? { backgroundColor: `hsl(var(--scene) / 0.12)` }
                  : undefined
              }
            >
              <span className={m.role === "you" ? "" : "text-foreground/90"}>{m.text}</span>
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
                className="text-left text-sm px-4 py-3 rounded-xl border border-border bg-background/70 hover:border-[hsl(var(--scene)_/_0.5)] hover:bg-[hsl(var(--scene)_/_0.06)] transition-colors"
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
            className="text-sm hover:underline shrink-0"
            style={{ color: `hsl(var(--scene))` }}
          >
            Begin again
          </button>
        </div>
      )}
    </div>
  );
}

function JournalPanel({ reduce }: { reduce: boolean }) {
  const [text, setText] = useState("");
  const [reflected, setReflected] = useState(false);

  return (
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-8 space-y-5">
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
        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-[hsl(var(--scene)_/_0.6)]"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!text.trim()) setText(JOURNAL_SAMPLE);
            setReflected(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: `hsl(var(--scene))` }}
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
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.5 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-[hsl(var(--scene)_/_0.06)] border border-[hsl(var(--scene)_/_0.2)] p-4 space-y-2">
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: `hsl(var(--scene))` }}
              >
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

function PracticePanel({ reduce }: { reduce: boolean }) {
  const [step, setStep] = useState(0);
  const active = PRACTICE_STEPS[step]!;
  const isLast = step >= PRACTICE_STEPS.length - 1;

  return (
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          A short grounding practice
        </p>
        <p className="font-serif text-lg leading-snug">Resting with a steady breath</p>
      </div>

      <div className="relative flex items-center justify-center py-8">
        <motion.div
          aria-hidden
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-40 h-40 rounded-full blur-2xl"
          style={{ backgroundColor: `hsl(var(--scene) / 0.2)` }}
        />
        <div className="relative w-28 h-28 rounded-full border border-[hsl(var(--scene)_/_0.35)] bg-background/60 flex items-center justify-center text-center px-4">
          <span className="text-xs text-muted-foreground">breathe in, breathe out</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={reduce ? undefined : { opacity: 0, y: 6 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
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
            className="text-sm hover:underline"
            style={{ color: `hsl(var(--scene))` }}
          >
            Begin again
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-[hsl(var(--scene)_/_0.4)] text-sm hover:bg-[hsl(var(--scene)_/_0.06)] transition-colors"
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
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-8 space-y-6">
      <p className="font-serif text-lg leading-snug">
        Right now, your grief seems to be asking for steady, caring support.
      </p>
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
      <p
        className="text-xs uppercase tracking-wider"
        style={{ color: `hsl(var(--scene))` }}
      >
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

function LovedOnePanel() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Sample content
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
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed text-foreground/90 italic border-l-2 border-[hsl(var(--scene)_/_0.4)] pl-3">
        {children}
      </p>
    </div>
  );
}

function CommunityPanel() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-8 space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        When you would like company, gently moderated rooms let you sit with
        others who are grieving too. You choose a screen name, share only what
        feels right, and every message is quietly watched over for distress.
      </p>

      <div className="rounded-xl border border-[hsl(var(--scene)_/_0.3)] bg-background/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full"
            style={{
              backgroundColor: `hsl(var(--scene) / 0.15)`,
              color: `hsl(var(--scene))`,
            }}
          >
            <MessagesSquare className="w-4 h-4" />
          </span>
          <p className="font-serif text-lg">Losing a parent</p>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> 8 here now
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-start">
            <p className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-muted text-foreground/90">
              Some mornings are heavier than others. You are not alone in that here.
            </p>
          </div>
          <div className="flex justify-end">
            <p
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-white"
              style={{ backgroundColor: `hsl(var(--scene))` }}
            >
              Thank you. It helps to read that today.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
        Your companion can suggest the room that fits where you are, and support
        is always one tap away. This is a sample of the community.
      </p>
    </div>
  );
}

function CrisisPanel() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-8 space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        On every single screen, quiet help is one tap away. If a conversation
        ever touches something heavy, MeaningBridge gently pauses and offers a
        calm way to reach a real person — never an alarm, never a lecture.
      </p>

      {/* A sample of the soft crisis card that can appear anywhere */}
      <div className="rounded-xl border border-[hsl(var(--scene)_/_0.3)] bg-[hsl(var(--scene)_/_0.06)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full"
            style={{
              backgroundColor: `hsl(var(--scene) / 0.15)`,
              color: `hsl(var(--scene))`,
            }}
          >
            <LifeBuoy className="w-4 h-4" />
          </span>
          <p className="font-serif text-lg">If this feels like too much</p>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">
          You do not have to carry it alone. Trained people are ready to listen,
          any hour, at no cost.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-white"
            style={{ backgroundColor: `hsl(var(--scene))` }}
          >
            <Phone className="w-3.5 h-3.5" />
            Call or text 988
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm border border-border text-foreground/80">
            More ways to reach a person
          </span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          988 is the Suicide &amp; Crisis Lifeline (US). This is a sample of what
          appears in the app.
        </p>
      </div>
    </div>
  );
}

const RECAP_ITEMS = SCENES.filter((s) => s.id !== "recap");

function RecapPanel({
  onSurvey,
  onReplay,
}: {
  onSurvey: () => void;
  onReplay: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--scene)_/_0.25)] bg-card p-6 md:p-10 space-y-8">
      <p className="text-center text-muted-foreground leading-relaxed max-w-xl mx-auto">
        A companion who stays, a place to write, quiet practices, a gentle sense
        of how you are, a profile that keeps your person close, others who
        understand when you want them, and help always within reach. All in one
        calm place.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {RECAP_ITEMS.map((s) => (
          <div
            key={s.id}
            className="flex flex-col items-center text-center gap-2 rounded-xl border border-border bg-background/60 p-4"
          >
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-full"
              style={{
                backgroundColor: `hsl(${s.accent} / 0.12)`,
                color: `hsl(${s.accent})`,
              }}
            >
              <s.icon className="w-4 h-4" />
            </span>
            <p className="text-xs font-medium leading-snug">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 pt-2">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: `hsl(var(--scene))` }}
          >
            Enter the experience
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/notify"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm border border-border text-foreground hover:border-foreground/40 transition-colors"
          >
            Notify me at launch
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={onReplay}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Watch again
          </button>
          <span className="h-3 w-px bg-border" />
          <button
            type="button"
            onClick={onSurvey}
            className="hover:underline"
            style={{ color: `hsl(var(--scene))` }}
          >
            Share your experience
          </button>
        </div>
      </div>
    </div>
  );
}
