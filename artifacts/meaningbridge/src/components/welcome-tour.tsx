import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Feather,
  BookOpen,
  Compass,
  Wind,
  Heart,
  Activity,
  LifeBuoy,
  MessagesSquare,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Step = {
  icon: typeof Feather;
  eyebrow: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: Feather,
    eyebrow: "Your companion",
    title: "A gentle guide, whenever you need one",
    body: "Talk through what you are carrying with a reflective companion grounded in Dr. Robert Neimeyer's meaning-focused approach. It listens, and stays with you, at your own pace.",
  },
  {
    icon: BookOpen,
    eyebrow: "Your journal",
    title: "A private place to write and remember",
    body: "Write freely, or begin with a gentle prompt. Your words are yours first — a quiet space to process, remember, and notice what you are feeling.",
  },
  {
    icon: Compass,
    eyebrow: "Reflections",
    title: "Research-grounded self-reflections",
    body: "Two calm, optional self-reflections on meaning and the rhythm of grieving, mirrored back to you in plain language. There are no scores here, only understanding.",
  },
  {
    icon: Wind,
    eyebrow: "Practices",
    title: "Small, steadying practices",
    body: "Short grounding and breathing practices for the harder moments. Take one when you need to rest, or return to your breath.",
  },
  {
    icon: MessagesSquare,
    eyebrow: "Community",
    title: "Others who understand, when you want them",
    body: "Gently moderated rooms let you sit with people who are grieving too. Share as much or as little as you like, support is quietly watched over, and it is always optional.",
  },
  {
    icon: Heart,
    eyebrow: "Your loved one",
    title: "Keep the person you are missing close",
    body: "Build a profile of your loved one — their name, the memories, the things you still want them to know. What you share shapes how the companion speaks with you.",
  },
  {
    icon: Activity,
    eyebrow: "How you are",
    title: "A caring read on how you are doing",
    body: "Over time, MeaningBridge reflects back what it notices — softly, and in words, never as a number. You decide what you need.",
  },
  {
    icon: LifeBuoy,
    eyebrow: "Support is always near",
    title: "Help is never more than a tap away",
    body: "Crisis support is present on every screen. If a moment ever feels like too much, it is always right there for you.",
  },
];

export function WelcomeTour({ firstName }: { firstName?: string | null }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const { mutateAsync: updateProfile } = useUpdateProfile();
  const queryClient = useQueryClient();

  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;
  const step = STEPS[index]!;
  const Icon = step.icon;

  const finish = async () => {
    // Hide immediately so dismissal feels instant, then persist that the tour
    // has been seen and prime the cache so it does not reappear this session.
    setVisible(false);
    try {
      const updated = await updateProfile({ data: { welcomeTourSeen: true } });
      queryClient.setQueryData(getGetProfileQueryKey(), updated);
    } catch {
      // If persistence fails the flag stays false and the tour returns next
      // visit; the person is not blocked from entering the app now.
    }
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome walkthrough"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-8 md:p-10 shadow-lg"
        >
          <div className="flex items-center justify-between mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {isFirst && firstName
                ? `Welcome, ${firstName}`
                : `Step ${index + 1} of ${STEPS.length}`}
            </p>
            <button
              type="button"
              onClick={finish}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>

          {isFirst && (
            <div className="mb-6 text-center space-y-3">
              <h2 className="font-serif text-2xl md:text-3xl leading-tight">
                {firstName ? `Welcome, ${firstName}.` : "Welcome."}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                This is a quiet space for your grief. Let us walk you through what
                you will find here, gently.
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-4"
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {step.eyebrow}
              </p>
              <h3 className="font-serif text-xl md:text-2xl leading-snug">
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">{step.body}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-center gap-2">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === index ? "w-6 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Enter MeaningBridge
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
