import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  MessageSquare,
  PenLine,
  CalendarClock,
} from "lucide-react";

type Tier = "universal" | "targeted" | "clinical";

interface DemoPatient {
  id: string;
  firstName: string;
  lastInitial: string;
  age: number;
  loss: string;
  monthsSinceLoss: number;
  tier: Tier;
  lastActivity: string;
  safetyFlags14d: number;
  engagement: number;
  recent: { kind: "session" | "journal" | "checkin"; when: string; detail: string }[];
  summary: string;
}

const TIER_META: Record<Tier, { label: string; tone: string }> = {
  universal: { label: "Grief Literacy", tone: "bg-muted text-muted-foreground" },
  targeted: { label: "Enhanced Support", tone: "bg-primary/10 text-primary" },
  clinical: { label: "Specialist Support", tone: "bg-destructive/10 text-destructive" },
};

const PATIENTS: DemoPatient[] = [
  {
    id: "p1",
    firstName: "Maya",
    lastInitial: "R",
    age: 47,
    loss: "partner",
    monthsSinceLoss: 8,
    tier: "clinical",
    lastActivity: "2 hours ago",
    safetyFlags14d: 0,
    engagement: 0.92,
    recent: [
      { kind: "session", when: "2 hours ago", detail: "Companion conversation, 24 minutes" },
      { kind: "journal", when: "yesterday", detail: "An imagined letter to David" },
    ],
    summary:
      "Maya has been sitting with the difference between missing David and looking for him. She named, for the first time, that some days the missing has become the relationship, and she is asking, gently, whether that counts.",
  },
  {
    id: "p2",
    firstName: "James",
    lastInitial: "K",
    age: 62,
    loss: "adult child",
    monthsSinceLoss: 14,
    tier: "clinical",
    lastActivity: "yesterday",
    safetyFlags14d: 2,
    engagement: 0.71,
    recent: [
      { kind: "checkin", when: "yesterday", detail: "Withdrawal noted, functioning low" },
      { kind: "session", when: "4 days ago", detail: "Companion conversation, 11 minutes" },
    ],
    summary:
      "James is pulling back from his sister and from work, and spoke about feeling he should be further along. Two structured safety signals in the past week. The companion paused and surfaced the crisis page, and he engaged with it.",
  },
  {
    id: "p3",
    firstName: "Sarah",
    lastInitial: "M",
    age: 34,
    loss: "mother",
    monthsSinceLoss: 4,
    tier: "targeted",
    lastActivity: "2 days ago",
    safetyFlags14d: 0,
    engagement: 0.55,
    recent: [
      { kind: "journal", when: "2 days ago", detail: "Three things I want her to know" },
    ],
    summary:
      "Sarah is sorting her mother's papers and finding letters she never knew about. She asked the companion how to tell whether she is delaying the harder grief.",
  },
  {
    id: "p4",
    firstName: "Devon",
    lastInitial: "S",
    age: 41,
    loss: "spouse",
    monthsSinceLoss: 6,
    tier: "clinical",
    lastActivity: "4 hours ago",
    safetyFlags14d: 0,
    engagement: 0.88,
    recent: [
      { kind: "session", when: "4 hours ago", detail: "Companion conversation, 31 minutes" },
      { kind: "journal", when: "this morning", detail: "On the smell of his coffee" },
    ],
    summary:
      "Devon has been working with the continuing bonds practice and asked whether it would be appropriate to bring the letters into the next session.",
  },
];

function ActivityIcon({ kind }: { kind: "session" | "journal" | "checkin" }) {
  const cls = "w-3.5 h-3.5 text-muted-foreground shrink-0";
  if (kind === "session") return <MessageSquare className={cls} />;
  if (kind === "journal") return <PenLine className={cls} />;
  return <CalendarClock className={cls} />;
}

export function TherapistDemo({
  onBack,
  onSurvey,
}: {
  onBack: () => void;
  onSurvey: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(PATIENTS[0]!.id);
  const selected = PATIENTS.find((p) => p.id === selectedId)!;
  const totalFlags = PATIENTS.reduce((s, p) => s + p.safetyFlags14d, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to the entrance
        </button>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Professional view, with sample data only
        </p>
        <h1 className="font-serif text-3xl md:text-4xl leading-tight">
          See how the people in your care are doing.
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          With each person's logged consent, MeaningBridge offers a quiet, honest
          read on their grief between sessions, so you can step in when it
          matters. You stay in the lead, always.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="People in your care" value={String(PATIENTS.length)} hint="active in the past 14 days" />
        <StatCard
          label="Safety signals"
          value={String(totalFlags)}
          hint="across the past 14 days"
          accent={totalFlags > 0}
        />
        <StatCard label="Consent" value="Logged" hint="nothing reaches you without it" />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium">Your roster</h2>
          </div>
          <div className="divide-y divide-border/60">
            {PATIENTS.map((p) => {
              const isSelected = p.id === selectedId;
              const tier = TIER_META[p.tier];
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-5 py-4 grid grid-cols-12 items-center gap-3 hover:bg-muted/30 transition-colors ${
                    isSelected ? "bg-muted/40" : ""
                  }`}
                >
                  <div className="col-span-5 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.firstName} {p.lastInitial}.
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.loss}, {p.monthsSinceLoss} months
                    </p>
                  </div>
                  <div className="col-span-4">
                    <span className={`inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded ${tier.tone}`}>
                      {tier.label}
                    </span>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground truncate">
                    {p.lastActivity}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {p.safetyFlags14d > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {p.safetyFlags14d}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">none</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <motion.aside
          key={selected.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2 rounded-xl border border-border bg-card p-6 space-y-6"
        >
          <div className="space-y-1">
            <h2 className="text-xl font-serif">
              {selected.firstName} {selected.lastInitial}., {selected.age}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selected.loss}, {selected.monthsSinceLoss} months since loss
            </p>
            <span
              className={`inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-1 rounded ${TIER_META[selected.tier].tone}`}
            >
              {TIER_META[selected.tier].label}
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Recent activity
            </p>
            <ul className="space-y-2">
              {selected.recent.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ActivityIcon kind={r.kind} />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground/90">{r.detail}</p>
                    <p className="text-xs text-muted-foreground">{r.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Safety
            </p>
            {selected.safetyFlags14d === 0 ? (
              <p className="text-sm text-muted-foreground">
                No safety signals in the past 14 days.
              </p>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-foreground/90">
                  {selected.safetyFlags14d} structured signal
                  {selected.safetyFlags14d > 1 ? "s" : ""} in the past 14 days. The
                  companion paused normal flow and surfaced crisis resources.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Briefing for your next session
            </p>
            <p className="text-sm text-foreground/90 italic leading-relaxed border-l-2 border-border pl-3">
              {selected.summary}
            </p>
          </div>
        </motion.aside>
      </div>

      <div className="rounded-2xl border border-border bg-card/70 p-6 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          We would be grateful to hear how this professional view felt to you.
        </p>
        <button
          type="button"
          onClick={onSurvey}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Share your experience
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 ${
        accent ? "border-destructive/30" : "border-border"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-serif ${accent ? "text-destructive" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
