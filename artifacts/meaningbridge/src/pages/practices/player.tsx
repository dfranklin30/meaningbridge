import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetPractice, getGetPracticeQueryKey } from "@workspace/api-client-react";
import type { PracticeBreathPatternItem } from "@workspace/api-client-react";
import { ArrowLeft, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COUNTER_PREF_KEY = "meaningbridge:breath-counter-visible";

function readCounterPref() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(COUNTER_PREF_KEY) !== "false";
}

function BreathCounter({ phases }: { phases: PracticeBreathPatternItem[] }) {
  const cycleSeconds = phases.reduce((sum, p) => sum + p.seconds, 0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick(0);
    if (cycleSeconds <= 0) return;
    const id = setInterval(() => setTick((t) => (t + 1) % cycleSeconds), 1000);
    return () => clearInterval(id);
  }, [cycleSeconds]);

  let remaining = tick;
  let phase = phases[0];
  let count = 1;
  for (const p of phases) {
    if (remaining < p.seconds) {
      phase = p;
      count = remaining + 1;
      break;
    }
    remaining -= p.seconds;
  }

  return (
    <div className="flex flex-col items-center gap-4" aria-hidden="true">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/10 border border-primary/20"
          initial={{ scale: 0.6 }}
          animate={{ scale: phase.scale }}
          transition={{ duration: phase.seconds, ease: [0.42, 0, 0.58, 1] }}
        />
        <span className="relative font-serif text-4xl text-primary tabular-nums">{count}</span>
      </div>
      <p className="text-sm text-muted-foreground tracking-wide">{phase.label}</p>
    </div>
  );
}

export default function PracticePlayer() {
  const { id } = useParams();
  const practiceId = parseInt(id || "0");
  const { data: practice } = useGetPractice(practiceId, { query: { enabled: !!practiceId, queryKey: getGetPracticeQueryKey(practiceId) } });

  const [currentStep, setCurrentStep] = useState(0);
  const [showCounter, setShowCounter] = useState(readCounterPref);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COUNTER_PREF_KEY, String(showCounter));
  }, [showCounter]);

  if (!practice) return null;

  const steps = practice.steps;
  const isLast = currentStep === steps.length - 1;
  const breathPattern = practice.breathPattern ?? [];
  const hasCounter = breathPattern.length > 0;

  return (
    <div className="max-w-2xl mx-auto min-h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-12 pb-4 border-b border-border/50">
        <Link href="/practices" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-serif text-xl">{practice.title}</h1>
          <div className="flex gap-2 text-xs text-muted-foreground capitalize mt-1">
            <span>{practice.category}</span>
            <span>•</span>
            <span>{practice.durationMinutes} min</span>
          </div>
        </div>
        {hasCounter && (
          <button
            type="button"
            onClick={() => setShowCounter((v) => !v)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-pressed={showCounter}
          >
            {showCounter ? "Hide counter" : "Show counter"}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-12 gap-10 relative">
        {hasCounter && showCounter && <BreathCounter phases={breathPattern} />}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="text-center px-4"
          >
            <p className="text-xl md:text-2xl font-serif leading-relaxed text-foreground/90">
              {steps[currentStep]}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-auto pt-8 flex flex-col items-center gap-6">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === currentStep ? 'w-6 bg-primary' : i < currentStep ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm text-muted-foreground disabled:opacity-0 transition-opacity"
          >
            Previous
          </button>
          
          {!isLast ? (
            <button
              onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <Link href="/practices" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
              <Check className="w-4 h-4" /> Complete
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
