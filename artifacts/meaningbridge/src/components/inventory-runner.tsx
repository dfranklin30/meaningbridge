import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export interface InventoryItem {
  id: number;
  prompt: string;
}

export interface InventoryScaleOption {
  value: number;
  label: string;
}

/**
 * A calm, one-item-at-a-time runner for a self-reflection inventory.
 * Selecting an option gently advances to the next item; a back affordance
 * lets the person revisit earlier answers. No gamification, no scores shown.
 */
export function InventoryRunner({
  items,
  scale,
  instructions,
  onComplete,
  submitting = false,
}: {
  items: InventoryItem[];
  scale: InventoryScaleOption[];
  instructions?: string;
  onComplete: (responses: number[]) => void;
  submitting?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => items.map(() => null),
  );

  const total = items.length;
  const item = items[index];
  const current = answers[index];
  const answeredCount = answers.filter((a) => a !== null).length;

  const choose = (value: number) => {
    const next = [...answers];
    next[index] = value;
    setAnswers(next);

    if (index < total - 1) {
      window.setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), 220);
    } else if (next.every((a) => a !== null)) {
      onComplete(next.map((a) => a as number));
    }
  };

  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  const allAnswered = answers.every((a) => a !== null);

  return (
    <div className="max-w-xl mx-auto space-y-8">
      {instructions && index === 0 && (
        <p className="text-sm text-muted-foreground leading-relaxed">{instructions}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {index + 1} of {total}
          </span>
          <span className="tabular-nums">{answeredCount} answered</span>
        </div>
        <div className="h-1 w-full rounded-full bg-secondary/50 overflow-hidden">
          <motion.div
            className="h-full bg-primary/70 rounded-full"
            initial={false}
            animate={{ width: `${((index + 1) / total) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 md:p-8 min-h-[18rem] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="flex flex-col gap-6"
          >
            <p className="text-lg md:text-xl font-serif text-foreground leading-relaxed">
              {item.prompt}
            </p>

            <div className="flex flex-col gap-2">
              {scale.map((opt) => {
                const selected = current === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => choose(opt.value)}
                    aria-pressed={selected}
                    className={[
                      "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:bg-secondary/30 text-foreground/90",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {allAnswered && (
          <button
            onClick={() => onComplete(answers.map((a) => a as number))}
            disabled={submitting}
            className="text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? "Saving" : "See your reflection"}
          </button>
        )}
      </div>
    </div>
  );
}
