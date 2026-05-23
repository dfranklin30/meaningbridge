import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetProfile,
  useUpdateProfile,
  getGetProfileQueryKey,
  useCreateDeceasedProfile,
  useSubmitGisScreener,
  type GisResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  GIS_ITEMS,
  GIS_SCALE,
  GIS_INSTRUCTIONS,
  TIER_LABELS,
  TIER_NARRATIVE,
  type Tier,
} from "../lib/clinical";

type Step = "name" | "loved-one" | "gis-intro" | "gis" | "tier" | "safety";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  useGetProfile();

  const [step, setStep] = useState<Step>("name");
  const [firstName, setFirstName] = useState("");
  const [deceasedName, setDeceasedName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [gis, setGis] = useState<Record<1 | 2 | 3 | 4 | 5, number | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
  });
  const [gisResult, setGisResult] = useState<GisResult | null>(null);

  const { mutateAsync: updateProfile } = useUpdateProfile();
  const { mutateAsync: createDeceased } = useCreateDeceasedProfile();
  const { mutateAsync: submitGis, isPending: gisSubmitting } = useSubmitGisScreener();

  const trimmedFirst = firstName.trim().split(/\s+/)[0] ?? "";

  const goName = async () => {
    await updateProfile({
      data: { name: firstName.trim(), firstName: trimmedFirst },
    });
    setStep("loved-one");
  };

  const goLovedOne = async () => {
    await createDeceased({
      data: { name: deceasedName.trim(), relationship: relationship.trim() },
    });
    setStep("gis-intro");
  };

  const gisComplete = (Object.values(gis) as (number | null)[]).every((v) => v !== null);

  const submitScreener = async () => {
    const result = await submitGis({
      data: {
        item1: gis[1]!,
        item2: gis[2]!,
        item3: gis[3]!,
        item4: gis[4]!,
        item5: gis[5]!,
      },
    });
    setGisResult(result);
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    // Per spec: GIS item 3 >= 2 routes to the safety layer, not "just scored."
    setStep(result.safetyFlag ? "safety" : "tier");
  };

  const finish = async () => {
    await updateProfile({
      data: {
        onboardingComplete: true,
        crisisAcknowledged: true,
        consentJournal: true,
        consentContinuingBonds: true,
        preferredMode: "continuing-bonds",
      },
    });
    queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    setLocation("/app");
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-serif text-foreground">MeaningBridge</h1>
        <p className="text-sm text-muted-foreground italic">
          A bridge between sessions, and a bridge to those we have loved.
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="bg-card border border-border p-7 rounded-xl shadow-sm"
        >
          {step === "name" && (
            <div className="space-y-6">
              <h2 className="text-xl font-serif">Before we begin, what may we call you?</h2>
              <p className="text-sm text-muted-foreground">
                Your first name is enough. We will greet you by it, never by a label.
              </p>
              <input
                autoFocus
                className="w-full bg-background border border-border rounded-md px-4 py-3"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
              <button
                className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium disabled:opacity-40"
                onClick={goName}
                disabled={!trimmedFirst}
              >
                Continue
              </button>
            </div>
          )}

          {step === "loved-one" && (
            <div className="space-y-6">
              <h2 className="text-xl font-serif">
                {trimmedFirst}, who are you carrying in your heart?
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Their name</label>
                  <input
                    className="w-full bg-background border border-border rounded-md px-4 py-3"
                    value={deceasedName}
                    onChange={(e) => setDeceasedName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Who they were to you
                  </label>
                  <input
                    className="w-full bg-background border border-border rounded-md px-4 py-3"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    placeholder="for example: my mother, my partner, my closest friend"
                  />
                </div>
              </div>
              <button
                className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium disabled:opacity-40"
                onClick={goLovedOne}
                disabled={!deceasedName.trim() || !relationship.trim()}
              >
                Continue
              </button>
            </div>
          )}

          {step === "gis-intro" && (
            <div className="space-y-6">
              <h2 className="text-xl font-serif">A few quiet questions, {trimmedFirst}.</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {GIS_INSTRUCTIONS}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                There are five. Your answers stay private and shape how this space meets you.
                There are no right answers, and there is no score we will hand back to you as a
                verdict.
              </p>
              <button
                className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium"
                onClick={() => setStep("gis")}
              >
                Begin
              </button>
            </div>
          )}

          {step === "gis" && (
            <div className="space-y-8">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                In the past 30 days
              </p>
              {GIS_ITEMS.map((item) => (
                <div key={item.id} className="space-y-3">
                  <p className="text-base text-foreground leading-relaxed">{item.prompt}</p>
                  <p className="text-xs text-muted-foreground italic">{item.examples}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {GIS_SCALE.map((opt) => {
                      const selected = gis[item.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setGis((g) => ({ ...g, [item.id]: opt.value }))
                          }
                          className={`p-2 rounded-md border text-xs leading-tight transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border hover:border-muted-foreground bg-background text-muted-foreground"
                          }`}
                        >
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-[10px] mt-0.5 opacity-80">{opt.helper}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium disabled:opacity-40"
                onClick={submitScreener}
                disabled={!gisComplete || gisSubmitting}
              >
                {gisSubmitting ? "Listening" : "Continue"}
              </button>
            </div>
          )}

          {step === "tier" && gisResult && (
            <div className="space-y-6">
              <h2 className="text-xl font-serif">Thank you for telling us, {trimmedFirst}.</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {TIER_NARRATIVE[gisResult.tier as Tier]}
              </p>
              <div className="bg-muted/40 border border-border p-4 rounded-md text-sm text-muted-foreground leading-relaxed">
                A note on safety: if you ever feel in danger, the crisis link in the corner is
                always one tap away. This space is not a substitute for clinical care.
              </div>
              <button
                className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium"
                onClick={finish}
              >
                Enter the space
              </button>
            </div>
          )}

          {step === "safety" && gisResult && (
            <div className="space-y-6">
              <h2 className="text-xl font-serif">
                Thank you for trusting us with that, {trimmedFirst}.
              </h2>
              <p className="text-sm text-foreground leading-relaxed">
                Some of what you described sounds really hard to carry alone. We want to gently
                pause here, before we go any further.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you are in immediate danger, or you are thinking about hurting yourself, please
                reach out to a person right now. In the US you can call or text{" "}
                <span className="text-foreground font-medium">988</span> to reach the Suicide &amp;
                Crisis Lifeline, any hour. Outside the US, the crisis page lists a few options.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href={`${import.meta.env.BASE_URL}crisis`}
                  className="block w-full text-center bg-primary text-primary-foreground py-3 rounded-md font-medium"
                >
                  Open the crisis page
                </a>
                <button
                  className="w-full bg-secondary text-secondary-foreground py-3 rounded-md"
                  onClick={finish}
                >
                  I am safe right now — continue
                </button>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Whatever you choose, this space will be here.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
