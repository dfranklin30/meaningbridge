import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ArrowLeft } from "lucide-react";
import { useCreateSandboxFeedback } from "@workspace/api-client-react";

type Role = "seeker" | "professional" | null;

const RATINGS = [
  {
    key: "navigation",
    label: "How easy it was to find your way",
    low: "I felt lost",
    high: "Effortless",
  },
  {
    key: "aesthetics",
    label: "How the experience looked and felt",
    low: "Not for me",
    high: "Calming and beautiful",
  },
  {
    key: "helpfulness",
    label: "How supported you felt",
    low: "Not helpful",
    high: "Deeply supportive",
  },
  {
    key: "overall",
    label: "Your overall experience",
    low: "Poor",
    high: "Excellent",
  },
] as const;

type RatingKey = (typeof RATINGS)[number]["key"];

const SCALE = [1, 2, 3, 4, 5];

export function SandboxSurvey({
  role,
  initialNarrative,
  onBack,
}: {
  role: Role;
  initialNarrative?: string;
  onBack: () => void;
}) {
  const [scores, setScores] = useState<Record<RatingKey, number | null>>({
    navigation: null,
    aesthetics: null,
    helpfulness: null,
    overall: null,
  });
  const [narrative, setNarrative] = useState(initialNarrative ?? "");
  const [name, setName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useCreateSandboxFeedback();

  const setScore = (key: RatingKey, value: number) =>
    setScores((s) => ({ ...s, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const missing = RATINGS.some((r) => scores[r.key] == null);
    if (missing) {
      setError("Please choose a number for each of the four questions above.");
      return;
    }
    try {
      await mutateAsync({
        data: {
          role,
          navigationRating: scores.navigation,
          aestheticsRating: scores.aesthetics,
          helpfulnessRating: scores.helpfulness,
          overallRating: scores.overall,
          narrative: narrative.trim() || null,
          name: name.trim() || null,
          roleLabel: roleLabel.trim() || null,
          consentToShare: consent,
          source: "sandbox",
        },
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again in a moment.");
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 md:p-10 text-center space-y-4"
      >
        <div className="mx-auto w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-serif text-2xl">Thank you.</h2>
        <p className="text-muted-foreground leading-relaxed">
          Your reflection helps shape MeaningBridge into something gentler and
          more useful for the people it is meant to hold. We are grateful you
          spent this time here.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-xl mx-auto space-y-8"
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Share your experience
        </p>
        <h1 className="font-serif text-3xl md:text-4xl leading-tight">
          How did this feel for you?
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          There are no wrong answers. Your honest impressions, and anything you
          would like to say in your own words, help us build something worthy of
          the people who will use it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
          {RATINGS.map((r) => (
            <div key={r.key} className="space-y-2">
              <p className="text-sm font-medium">{r.label}</p>
              <div className="flex gap-2">
                {SCALE.map((n) => {
                  const active = scores[r.key] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${r.label}: ${n} of 5`}
                      onClick={() => setScore(r.key, n)}
                      className={`flex-1 py-2.5 rounded-md border text-sm transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{r.low}</span>
                <span>{r.high}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="space-y-2">
            <label
              htmlFor="narrative"
              className="text-sm font-medium"
            >
              In your own words{" "}
              <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <p className="text-xs text-muted-foreground">
              What stayed with you? What would you want the people who build this
              to know?
            </p>
            <textarea
              id="narrative"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={5}
              placeholder="Anything you would like to share."
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
                placeholder="Bereaved parent, grief therapist"
                className="w-full bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-muted-foreground leading-relaxed">
              You may share my words as a testimonial. My reflection can help
              others understand what MeaningBridge offers.
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-primary text-primary-foreground rounded-md py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Sending" : "Share my reflection"}
        </button>
      </form>
    </motion.div>
  );
}
