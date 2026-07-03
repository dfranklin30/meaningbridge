import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowLeft, Plus, X } from "lucide-react";
import { useCreateSandboxFeedback } from "@workspace/api-client-react";
import { Logo } from "@/components/logo";
import { LivingBackground } from "@/components/living-background";

type Dimension = {
  key: string;
  label: string;
  help: string;
  low: string;
  high: string;
  optional?: boolean;
};

// Dimensions requested for the evaluation, plus a few standard measures from
// user-satisfaction research (trust/safety, overall ease of use, likelihood to
// recommend). Fidelity-of-voice and therapist value are marked optional since
// they only apply to some visitors.
const DIMENSIONS: Dimension[] = [
  {
    key: "navigation",
    label: "Ease of navigation",
    help: "How easily you could find your way around.",
    low: "I felt lost",
    high: "Effortless",
  },
  {
    key: "aesthetics",
    label: "Aesthetics",
    help: "How the experience looked and felt.",
    low: "Not for me",
    high: "Calming and beautiful",
  },
  {
    key: "tone",
    label: "Tone of language for grievers",
    help: "Whether the words felt gentle and fitting for someone who is grieving.",
    low: "Off-key",
    high: "Deeply attuned",
  },
  {
    key: "relevance",
    label: "Relevance of the features",
    help: "How relevant the features felt to real needs in grief.",
    low: "Not relevant",
    high: "Very relevant",
  },
  {
    key: "helpfulness",
    label: "Helpfulness to the bereaved",
    help: "How helpful this could be to someone who is bereaved.",
    low: "Not helpful",
    high: "Deeply supportive",
  },
  {
    key: "fidelity",
    label: "Fidelity to the voice of the deceased",
    help: "If the companion reflected the person who died, how true that felt. Skip if this did not apply.",
    low: "Did not ring true",
    high: "Felt faithful",
    optional: true,
  },
  {
    key: "therapistValue",
    label: "Helpfulness to therapists",
    help: "How useful the tools could be to a therapist — session summaries, assessments, suggestions. Skip if this did not apply.",
    low: "Not useful",
    high: "Very useful",
    optional: true,
  },
  {
    key: "trust",
    label: "Trust and sense of safety",
    help: "How much you trusted it and felt safe while using it.",
    low: "Uneasy",
    high: "Fully at ease",
  },
  {
    key: "easeOfUse",
    label: "Overall ease of use",
    help: "How easy the experience was to use, overall.",
    low: "Confusing",
    high: "Very easy",
  },
  {
    key: "recommend",
    label: "Likelihood to recommend",
    help: "How likely you would be to recommend it to someone who could use it.",
    low: "Unlikely",
    high: "Very likely",
  },
];

function EvalRow({
  dim,
  value,
  comment,
  onChange,
  onComment,
}: {
  dim: Dimension;
  value: number | null;
  comment: string;
  onChange: (v: number) => void;
  onComment: (v: string) => void;
}) {
  const [showComment, setShowComment] = useState(comment.length > 0);

  return (
    <div className="space-y-3 py-5 border-b border-border/60 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-medium">
          {dim.label}
          {dim.optional && (
            <span className="ml-2 text-xs font-normal text-muted-foreground/70">
              if applicable
            </span>
          )}
        </label>
        <span
          className="text-base font-serif text-primary tabular-nums min-w-[2ch] text-right"
          aria-hidden="true"
        >
          {value ?? "\u2014"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{dim.help}</p>
      <input
        type="range"
        min="0"
        max="10"
        value={value ?? 5}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full accent-primary ${value == null ? "opacity-50" : ""}`}
        aria-label={`${dim.label}${value == null ? ", not yet rated" : `, ${value} out of 10`}`}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{dim.low}</span>
        <span>{dim.high}</span>
      </div>

      {!showComment ? (
        <button
          type="button"
          onClick={() => setShowComment(true)}
          className="inline-flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add a comment
        </button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="relative pt-1">
              <textarea
                value={comment}
                onChange={(e) => onComment(e.target.value)}
                rows={3}
                placeholder="Anything you would like to say about this."
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => {
                  onComment("");
                  setShowComment(false);
                }}
                aria-label="Remove comment"
                className="absolute top-3 right-2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "seeker", label: "Someone who is grieving" },
  { value: "professional", label: "A therapist or clinician" },
  { value: "researcher", label: "A researcher or reviewer" },
  { value: "other", label: "Something else" },
];

export default function EvaluatePage() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [roleChoice, setRoleChoice] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [name, setName] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useCreateSandboxFeedback();

  const setScore = (key: string, v: number) =>
    setScores((s) => ({ ...s, [key]: v }));
  const setComment = (key: string, v: string) =>
    setComments((c) => ({ ...c, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (Object.keys(scores).length === 0 && !suggestions.trim()) {
      setError(
        "Please rate at least one dimension, or leave a suggestion, before sending.",
      );
      return;
    }

    // Only send comments that belong to a rated dimension and hold text.
    const trimmedComments: Record<string, string> = {};
    for (const [k, v] of Object.entries(comments)) {
      if (v.trim()) trimmedComments[k] = v.trim();
    }

    const role =
      roleChoice === "seeker" || roleChoice === "professional"
        ? roleChoice
        : null;

    const derivedRoleLabel =
      roleLabel.trim() ||
      (roleChoice
        ? ROLE_OPTIONS.find((r) => r.value === roleChoice)?.label ?? null
        : null);

    try {
      await mutateAsync({
        data: {
          role,
          roleLabel: derivedRoleLabel,
          name: name.trim() || null,
          ratings: Object.keys(scores).length ? scores : null,
          comments: Object.keys(trimmedComments).length ? trimmedComments : null,
          additionalSuggestions: suggestions.trim() || null,
          consentToShare: consent,
          source: "site-eval",
        },
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again in a moment.");
    }
  };

  return (
    <div className="min-h-[100dvh] text-foreground font-sans relative overflow-hidden isolate">
      <LivingBackground />

      <header className="relative z-10 px-6 py-6 max-w-3xl mx-auto flex items-center justify-between gap-4">
        <Link href="/">
          <Logo variant="lockup" size={44} />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
      </header>

      <main className="relative z-10 px-6 pb-24 max-w-3xl mx-auto">
        {submitted ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl mx-auto mt-10 rounded-2xl border border-border bg-card p-8 md:p-10 text-center space-y-4"
          >
            <div className="mx-auto w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-serif text-2xl">Thank you.</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your reflection helps shape MeaningBridge into something gentler
              and more useful for the people it is meant to hold. We are grateful
              you spent this time here.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return home
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8 pt-4"
          >
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-primary/80">
                Help us shape MeaningBridge
              </p>
              <h1 className="font-serif text-3xl md:text-4xl leading-tight">
                How did this feel for you?
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                There are no wrong answers. Move each slider to reflect your
                impression, and open a comment wherever you would like to say
                more. Rate only what applies to you — anything you leave
                untouched is simply left unrated.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="rounded-2xl border border-border bg-card px-6 md:px-8 py-2">
                {DIMENSIONS.map((dim) => (
                  <EvalRow
                    key={dim.key}
                    dim={dim}
                    value={scores[dim.key] ?? null}
                    comment={comments[dim.key] ?? ""}
                    onChange={(v) => setScore(dim.key, v)}
                    onComment={(v) => setComment(dim.key, v)}
                  />
                ))}
              </div>

              <div className="space-y-5 rounded-2xl border border-border bg-card p-6 md:p-8">
                <div className="space-y-2">
                  <label htmlFor="suggestions" className="text-sm font-medium">
                    Additional suggestions{" "}
                    <span className="text-muted-foreground/70">(optional)</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Anything else you would want the people who build this to
                    know — what stayed with you, what is missing, what you would
                    change.
                  </p>
                  <textarea
                    id="suggestions"
                    value={suggestions}
                    onChange={(e) => setSuggestions(e.target.value)}
                    rows={5}
                    placeholder="Anything you would like to share."
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="roleChoice" className="text-sm font-medium">
                      You are{" "}
                      <span className="text-muted-foreground/70">(optional)</span>
                    </label>
                    <select
                      id="roleChoice"
                      value={roleChoice}
                      onChange={(e) => setRoleChoice(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      Your name{" "}
                      <span className="text-muted-foreground/70">(optional)</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="What may we call you?"
                      className="w-full bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>

                {roleChoice === "other" && (
                  <div className="space-y-2">
                    <label htmlFor="roleLabel" className="text-sm font-medium">
                      How you would describe yourself{" "}
                      <span className="text-muted-foreground/70">(optional)</span>
                    </label>
                    <input
                      id="roleLabel"
                      type="text"
                      value={roleLabel}
                      onChange={(e) => setRoleLabel(e.target.value)}
                      placeholder="Bereaved parent, grief educator"
                      className="w-full bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                    />
                  </div>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground leading-relaxed">
                    You may share my words as a testimonial. My reflection can
                    help others understand what MeaningBridge offers.
                  </span>
                </label>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-primary text-primary-foreground rounded-full py-3.5 text-base font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Sending" : "Share my reflection"}
              </button>
            </form>
          </motion.div>
        )}
      </main>

      <footer className="relative z-10 border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        MeaningBridge augments therapists and human connection. It is not a
        substitute for professional care.
      </footer>
    </div>
  );
}
