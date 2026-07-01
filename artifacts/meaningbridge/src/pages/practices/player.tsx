import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useGetPractice, getGetPracticeQueryKey } from "@workspace/api-client-react";
import type { PracticeBreathPatternItem } from "@workspace/api-client-react";
import { ArrowLeft, ChevronRight, Check, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COUNTER_PREF_KEY = "meaningbridge:breath-counter-visible";
const CUE_PREF_KEY = "meaningbridge:breath-cue-enabled";

// Soft tones for each phase boundary, mapped by phase index (calm, low amplitude).
const CUE_FREQUENCIES = [528, 440, 396, 352];

function readCounterPref() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(COUNTER_PREF_KEY) !== "false";
}

function readCuePref() {
  // Default off: trauma-informed, never a surprise sound.
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CUE_PREF_KEY) === "true";
}

// Tracks the OS "reduce motion" setting. We treat it as a hard suppressor for
// both the chime and the haptic (a vibration is motion), regardless of the
// in-app toggle.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext) sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

// A gentle sine tone with a slow attack and a long, soft decay — no clicks, no harsh edges.
function playChime(frequency: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.2);
}

function triggerHaptic() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(35);
  }
}

type BreathState = { count: number; phase: PracticeBreathPatternItem; phaseIndex: number };

// Drives the breath cycle. Runs whenever `active`, independent of whether the
// visual counter is shown, so cues can play with eyes closed.
function useBreathPhase(phases: PracticeBreathPatternItem[], active: boolean): BreathState | null {
  const cycleSeconds = phases.reduce((sum, p) => sum + p.seconds, 0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick(0);
    if (!active || cycleSeconds <= 0) return;
    const id = setInterval(() => setTick((t) => (t + 1) % cycleSeconds), 1000);
    return () => clearInterval(id);
  }, [cycleSeconds, active]);

  if (phases.length === 0) return null;

  let remaining = tick;
  let phaseIndex = 0;
  let phase = phases[0];
  let count = 1;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (remaining < p.seconds) {
      phaseIndex = i;
      phase = p;
      count = remaining + 1;
      break;
    }
    remaining -= p.seconds;
  }

  return { count, phase, phaseIndex };
}

function BreathCounter({ state }: { state: BreathState }) {
  const { count, phase } = state;
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
  const [cueEnabled, setCueEnabled] = useState(readCuePref);
  const reducedMotion = usePrefersReducedMotion();

  // Reduced motion is a hard suppressor: no chime, no haptic, even if the
  // in-app toggle is on. The sound toggle is hidden in that case.
  const cuesAllowed = cueEnabled && !reducedMotion;

  const breathPattern = practice?.breathPattern ?? [];
  const hasCounter = breathPattern.length > 0;
  // Keep the cycle running while the counter is shown OR while cues are on, so
  // people can hide the counter, close their eyes, and still hear the rhythm.
  const breathActive = hasCounter && (showCounter || cuesAllowed);
  const breathState = useBreathPhase(breathPattern, breathActive);
  const phaseIndex = breathState?.phaseIndex ?? -1;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COUNTER_PREF_KEY, String(showCounter));
  }, [showCounter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUE_PREF_KEY, String(cueEnabled));
  }, [cueEnabled]);

  // Fire a soft chime + haptic at each phase boundary. Skips the initial phase
  // and any change while cues are off, so toggling never produces a stray sound.
  const prevPhaseRef = useRef(-1);
  useEffect(() => {
    if (!cuesAllowed || !breathActive || phaseIndex < 0) {
      prevPhaseRef.current = phaseIndex;
      return;
    }
    if (prevPhaseRef.current === -1) {
      prevPhaseRef.current = phaseIndex;
      return;
    }
    if (prevPhaseRef.current !== phaseIndex) {
      playChime(CUE_FREQUENCIES[phaseIndex % CUE_FREQUENCIES.length]);
      triggerHaptic();
    }
    prevPhaseRef.current = phaseIndex;
  }, [phaseIndex, cuesAllowed, breathActive]);

  function toggleCue() {
    setCueEnabled((v) => {
      const next = !v;
      if (next) {
        // Enabling is a user gesture: prime (create + resume) the audio context
        // now so the first phase-boundary chime isn't blocked by autoplay
        // policy. No tone is played here — cues fire only at phase boundaries.
        const ctx = getAudioContext();
        if (ctx?.state === "suspended") void ctx.resume();
      }
      return next;
    });
  }

  if (!practice) return null;

  const steps = practice.steps;
  const isLast = currentStep === steps.length - 1;

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
          <div className="ml-auto flex items-center gap-3">
            {!reducedMotion && (
              <button
                type="button"
                onClick={toggleCue}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-pressed={cueEnabled}
                title={cueEnabled ? "Turn off the gentle chime at each breath" : "Play a gentle chime at each breath"}
              >
                {cueEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                {cueEnabled ? "Sound on" : "Sound off"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCounter((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-pressed={showCounter}
            >
              {showCounter ? "Hide counter" : "Show counter"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-12 gap-10 relative">
        {hasCounter && showCounter && breathState && <BreathCounter state={breathState} />}
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
