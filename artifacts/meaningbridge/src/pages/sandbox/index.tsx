import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Heart, Stethoscope, MessageSquareQuote } from "lucide-react";
import { Logo } from "@/components/logo";
import { LivingBackground } from "@/components/living-background";
import { CapabilityShowcase } from "../demo";
import { PatientDemo } from "./patient-demo";
import { TherapistDemo } from "./therapist-demo";
import { SandboxSurvey } from "./survey";
import { GuidedWalkthrough } from "./walkthrough";

type Step = "entry" | "guided" | "patient" | "therapist" | "survey";
type Role = "seeker" | "professional" | null;

export default function Sandbox() {
  const [step, setStep] = useState<Step>("entry");
  const [role, setRole] = useState<Role>(null);
  const [walkNarrative, setWalkNarrative] = useState("");

  const goSurvey = (r: Role) => {
    setRole(r);
    setStep("survey");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const go = (next: Step) => {
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      <LivingBackground />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 dawn-glow" />

      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-sm border-b border-border/40">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
              <Logo variant="lockup" size={38} />
            </div>
          </Link>
          <button
            type="button"
            onClick={() => goSurvey(role)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            Share your experience
          </button>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl mx-auto px-4 py-12 md:py-16">
        {step === "entry" && (
          <Entry
            onGuided={() => go("guided")}
            onPatient={() => go("patient")}
            onTherapist={() => go("therapist")}
          />
        )}
        {step === "guided" && (
          <GuidedWalkthrough
            onExit={() => go("entry")}
            onFinish={(r, summary) => {
              setWalkNarrative(summary);
              setRole(r);
              go("survey");
            }}
          />
        )}
        {step === "patient" && (
          <PatientDemo onBack={() => go("entry")} onSurvey={() => goSurvey("seeker")} />
        )}
        {step === "therapist" && (
          <TherapistDemo
            onBack={() => go("entry")}
            onSurvey={() => goSurvey("professional")}
          />
        )}
        {step === "survey" && (
          <SandboxSurvey
            role={role}
            initialNarrative={walkNarrative}
            onBack={() =>
              go(
                role === "professional"
                  ? "therapist"
                  : role === "seeker"
                    ? "patient"
                    : "entry",
              )
            }
          />
        )}
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground space-y-1">
        <p>A sandbox preview. All content here is a sample, shown for exploration.</p>
        <p>MeaningBridge, brought to you by Dr. Robert Neimeyer</p>
      </footer>
    </div>
  );
}

function Entry({
  onGuided,
  onPatient,
  onTherapist,
}: {
  onGuided: () => void;
  onPatient: () => void;
  onTherapist: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-14"
    >
      <div className="max-w-3xl mx-auto text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          A place to explore, gently
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight tracking-tight">
          Welcome. Step inside and see what MeaningBridge can hold for you.
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          MeaningBridge is a warm companion for grief, grounded in Dr. Robert
          Neimeyer's meaning reconstruction and continuing bonds approach. Below
          is everything it offers. When you are ready, choose a way to walk
          through it.
        </p>
        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onGuided}
            className="group inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 text-base font-medium shadow-sm shadow-primary/20 hover:bg-primary/90 transition-colors"
          >
            Take the guided walkthrough
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <span className="text-xs text-muted-foreground">
            Step through every capability, one at a time. No account needed.
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Everything MeaningBridge offers
          </p>
          <p className="text-muted-foreground leading-relaxed">
            A closer look at each capability, for those grieving and for the
            professionals who support them. Every example below is an
            illustration of the real feature.
          </p>
        </div>
        <CapabilityShowcase />
      </div>

      <div className="max-w-4xl mx-auto space-y-4">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Choose how you would like to explore
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <RoleCard
            icon={Heart}
            title="Enter as someone who is grieving"
            body="Walk through the companion, the journal, a quiet practice, and more, as though it were yours."
            cta="Begin the walkthrough"
            onClick={onPatient}
          />
          <RoleCard
            icon={Stethoscope}
            title="Enter as a therapist"
            body="See the consented, between-sessions view of the people in your care, with sample data."
            cta="View the professional side"
            onClick={onTherapist}
          />
        </div>
      </div>
    </motion.div>
  );
}

function RoleCard({
  icon: Icon,
  title,
  body,
  cta,
  onClick,
}: {
  icon: typeof Heart;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-border bg-card p-6 md:p-7 space-y-4 hover:border-primary/50 transition-colors"
    >
      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h2 className="font-serif text-xl leading-snug">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
      <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
        {cta}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  );
}
