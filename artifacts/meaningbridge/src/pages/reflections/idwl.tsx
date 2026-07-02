import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useSubmitIdwl,
  useListIdwlResults,
  getListIdwlResultsQueryKey,
  type IdwlResult,
  type IdwlCompanion,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  IDWL_ITEMS,
  IDWL_SCALE,
  IDWL_INSTRUCTIONS,
  IDWL_COMPANION_INTRO,
  IDWL_C1,
  IDWL_C2,
  IDWL_C4,
  IDWL_C3_OPTIONS,
  IDWL_C5_PROMPT,
  idwlBalanceNarrative,
} from "../../lib/clinical";
import { InventoryRunner } from "../../components/inventory-runner";

type Step = "intro" | "items" | "companion" | "result";

export default function IdwlPage() {
  const queryClient = useQueryClient();
  const { data: history } = useListIdwlResults();
  const { mutateAsync: submit, isPending } = useSubmitIdwl();

  const [step, setStep] = useState<Step>("intro");
  const [responses, setResponses] = useState<number[]>([]);
  const [result, setResult] = useState<IdwlResult | null>(null);

  const handleItemsDone = (r: number[]) => {
    setResponses(r);
    setStep("companion");
  };

  const handleCompanionDone = async (companion: IdwlCompanion) => {
    const res = await submit({ data: { responses, companion } });
    queryClient.invalidateQueries({ queryKey: getListIdwlResultsQueryKey() });
    setResult(res);
    setStep("result");
  };

  if (step === "result" && result) {
    return (
      <IdwlResultView
        result={result}
        onRetake={() => {
          setResult(null);
          setResponses([]);
          setStep("items");
        }}
      />
    );
  }

  if (step === "companion") {
    return <CompanionStep onDone={handleCompanionDone} submitting={isPending} />;
  }

  if (step === "items") {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-serif">Moving between grief and life</h1>
        </div>
        <InventoryRunner
          items={IDWL_ITEMS}
          scale={IDWL_SCALE}
          instructions={IDWL_INSTRUCTIONS}
          onComplete={handleItemsDone}
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-8">
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
          Inventory of Daily Widowed Life
        </p>
        <h1 className="text-3xl font-serif text-foreground">Moving between grief and life</h1>
        <p className="text-muted-foreground leading-relaxed">
          {IDWL_INSTRUCTIONS} Afterward you will see how this past week moved
          between leaning into the loss and tending to daily life — the natural
          rhythm of grieving.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setStep("items")}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          {history && history.length > 0 ? "Reflect again" : "Begin"}
        </button>
        <Link href="/reflections" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Back to reflections
        </Link>
      </div>
    </div>
  );
}

function CompanionSlider({
  prompt,
  low,
  high,
  value,
  onChange,
}: {
  prompt: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/90 leading-relaxed">{prompt}</p>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-primary"
        aria-label={prompt}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function CompanionStep({
  onDone,
  submitting,
}: {
  onDone: (c: IdwlCompanion) => void;
  submitting: boolean;
}) {
  const [awarenessLoss, setAwarenessLoss] = useState(3);
  const [awarenessRestoration, setAwarenessRestoration] = useState(3);
  const [oscillationFrequency, setOscillationFrequency] = useState(2);
  const [control, setControl] = useState(3);

  return (
    <div className="max-w-xl mx-auto space-y-8 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-serif">A few last reflections</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{IDWL_COMPANION_INTRO}</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-8">
        <CompanionSlider
          prompt={IDWL_C1.prompt}
          low={IDWL_C1.low}
          high={IDWL_C1.high}
          value={awarenessLoss}
          onChange={setAwarenessLoss}
        />
        <CompanionSlider
          prompt={IDWL_C2.prompt}
          low={IDWL_C2.low}
          high={IDWL_C2.high}
          value={awarenessRestoration}
          onChange={setAwarenessRestoration}
        />

        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-sm text-foreground/90 leading-relaxed">
            During the past week, to what extent have you gone back and forth
            between focusing on both of these?
          </p>
          <div className="flex flex-col gap-2">
            {IDWL_C3_OPTIONS.map((opt) => {
              const selected = oscillationFrequency === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setOscillationFrequency(opt.value)}
                  aria-pressed={selected}
                  className={[
                    "w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm",
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
        </div>

        <div className="pt-2 border-t border-border">
          <CompanionSlider
            prompt={IDWL_C4.prompt}
            low={IDWL_C4.low}
            high={IDWL_C4.high}
            value={control}
            onChange={setControl}
          />
        </div>
      </div>

      <button
        onClick={() =>
          onDone({ awarenessLoss, awarenessRestoration, oscillationFrequency, control })
        }
        disabled={submitting}
        className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {submitting ? "Saving" : "See your reflection"}
      </button>
    </div>
  );
}

function IdwlResultView({ result, onRetake }: { result: IdwlResult; onRetake: () => void }) {
  const [, setLocation] = useLocation();
  const { lossOriented, restorationOriented, balance } = result;
  const narrative = idwlBalanceNarrative(balance);

  const total = lossOriented + restorationOriented;
  const lossPct = total > 0 ? (lossOriented / total) * 100 : 50;
  const restorePct = 100 - lossPct;

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-serif">Your reflection</h1>
        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
          There is no healthier balance to reach for. Grieving well means moving
          between both, in whatever rhythm is yours right now.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="bg-card border border-border rounded-xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
          <span>Leaning into the loss</span>
          <span>Tending to daily life</span>
        </div>
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-secondary/40">
          <motion.div
            className="h-full bg-primary/40"
            initial={{ width: "50%" }}
            animate={{ width: `${lossPct}%` }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          />
          <motion.div
            className="h-full bg-primary/70"
            initial={{ width: "50%" }}
            animate={{ width: `${restorePct}%` }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          />
        </div>
        <div className="space-y-2 pt-2">
          <h3 className="font-serif text-lg text-foreground">{narrative.title}</h3>
          <p className="text-sm text-foreground/90 leading-relaxed">{narrative.body}</p>
        </div>
      </motion.div>

      <div className="bg-secondary/20 border border-border rounded-xl p-5 space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
          A prompt to carry with you
        </p>
        <p className="text-base font-serif text-foreground leading-relaxed">{IDWL_C5_PROMPT}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          There is no need to answer it here. If it stays with you, the journal is
          a private place to follow the thought.
        </p>
        <Link
          href="/journal/new"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Write in your journal
        </Link>
      </div>

      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={() => setLocation("/dashboard")}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          See this over time
        </button>
        <button
          onClick={onRetake}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Reflect again
        </button>
      </div>
    </div>
  );
}
