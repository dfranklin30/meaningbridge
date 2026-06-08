import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Show, useClerk } from "@clerk/react";
import {
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Circle,
  MessageSquare,
  CalendarClock,
  PenLine,
  Activity,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/logo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function CaregiverAccountNav() {
  const { signOut } = useClerk();
  return (
    <>
      <Show when="signed-out">
        <Link href="/pricing" className="hover:text-foreground transition-colors">
          Plans
        </Link>
        <Link
          href="/notify?src=caregiver-preview"
          className="px-4 py-1.5 rounded-md border border-border hover:border-foreground transition-colors"
        >
          Join the caregiver waitlist
        </Link>
      </Show>
      <Show when="signed-in">
        <Link href="/pricing" className="hover:text-foreground transition-colors">
          Plans
        </Link>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-border hover:border-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </Show>
    </>
  );
}

/**
 * Caregiver portal preview — all data on this page is sample data,
 * displayed for visual exploration of the look-and-feel only. No PHI.
 */

type Tier = "universal" | "targeted" | "clinical";
type ConsentState = "active" | "pending" | "private";

interface MockPatient {
  id: string;
  firstName: string;
  lastInitial: string;
  age: number;
  lossSummary: string;
  monthsSinceLoss: number;
  tier: Tier;
  lastActivity: string;
  consent: ConsentState;
  safetyFlags14d: number;
  engagement: number; // 0-1
  recent: { kind: "session" | "journal" | "checkin"; when: string; detail: string }[];
  summary: string;
}

const TIER_META: Record<Tier, { label: string; tone: string }> = {
  universal: { label: "Grief Literacy", tone: "bg-muted text-muted-foreground" },
  targeted: { label: "Enhanced Support", tone: "bg-primary/10 text-primary" },
  clinical: { label: "Specialist Support", tone: "bg-destructive/10 text-destructive" },
};

const CONSENT_META: Record<ConsentState, { label: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Consent active", icon: CheckCircle2 },
  pending: { label: "Consent pending", icon: Circle },
  private: { label: "Private", icon: ShieldAlert },
};

const PATIENTS: MockPatient[] = [
  {
    id: "p1",
    firstName: "Maya",
    lastInitial: "R",
    age: 47,
    lossSummary: "partner",
    monthsSinceLoss: 8,
    tier: "clinical",
    lastActivity: "2 hours ago",
    consent: "active",
    safetyFlags14d: 0,
    engagement: 0.92,
    recent: [
      { kind: "session", when: "2 hours ago", detail: "Companion conversation, 24 minutes" },
      { kind: "journal", when: "yesterday", detail: "An imagined letter to David" },
      { kind: "checkin", when: "3 days ago", detail: "Sleep low, meaning steady" },
    ],
    summary:
      "Maya has been sitting with the difference between missing David and looking for him. She named, for the first time, that some days she wants the missing to be the relationship now. She is asking, gently, whether that counts.",
  },
  {
    id: "p2",
    firstName: "James",
    lastInitial: "K",
    age: 62,
    lossSummary: "adult child",
    monthsSinceLoss: 14,
    tier: "clinical",
    lastActivity: "yesterday",
    consent: "active",
    safetyFlags14d: 2,
    engagement: 0.71,
    recent: [
      { kind: "checkin", when: "yesterday", detail: "Withdrawal flag, functioning low" },
      { kind: "session", when: "4 days ago", detail: "Companion conversation, 11 minutes" },
    ],
    summary:
      "James is pulling back from his sister and from work. He spoke about feeling that he should be further along. Two structured safety signals in the past week — the companion paused and surfaced the crisis page; he engaged.",
  },
  {
    id: "p3",
    firstName: "Sarah",
    lastInitial: "M",
    age: 34,
    lossSummary: "mother",
    monthsSinceLoss: 4,
    tier: "targeted",
    lastActivity: "2 days ago",
    consent: "active",
    safetyFlags14d: 0,
    engagement: 0.55,
    recent: [
      { kind: "journal", when: "2 days ago", detail: "Three things I want her to know" },
      { kind: "session", when: "5 days ago", detail: "Companion conversation, 18 minutes" },
    ],
    summary:
      "Sarah is in the middle of arranging her mother's papers and discovering letters she never knew about. She asked the companion how to tell whether she is delaying the harder grief.",
  },
  {
    id: "p4",
    firstName: "Andre",
    lastInitial: "P",
    age: 51,
    lossSummary: "brother (sudden)",
    monthsSinceLoss: 2,
    tier: "targeted",
    lastActivity: "3 days ago",
    consent: "pending",
    safetyFlags14d: 1,
    engagement: 0.43,
    recent: [
      { kind: "session", when: "3 days ago", detail: "Companion conversation, 9 minutes" },
    ],
    summary: "Consent for shared summaries is pending. Activity counts visible only.",
  },
  {
    id: "p5",
    firstName: "Lin",
    lastInitial: "T",
    age: 29,
    lossSummary: "grandparent",
    monthsSinceLoss: 11,
    tier: "universal",
    lastActivity: "a week ago",
    consent: "active",
    safetyFlags14d: 0,
    engagement: 0.34,
    recent: [{ kind: "checkin", when: "a week ago", detail: "Steady" }],
    summary:
      "Lin checks in lightly, mostly to keep the relationship in motion. No concerns flagged.",
  },
  {
    id: "p6",
    firstName: "Devon",
    lastInitial: "S",
    age: 41,
    lossSummary: "spouse",
    monthsSinceLoss: 6,
    tier: "clinical",
    lastActivity: "4 hours ago",
    consent: "active",
    safetyFlags14d: 0,
    engagement: 0.88,
    recent: [
      { kind: "session", when: "4 hours ago", detail: "Companion conversation, 31 minutes" },
      { kind: "journal", when: "this morning", detail: "On the smell of his coffee" },
    ],
    summary:
      "Devon has been working with the continuing-bonds practice and asked whether it would be appropriate to bring the letters into next session.",
  },
];

function ActivityIcon({ kind }: { kind: "session" | "journal" | "checkin" }) {
  const cls = "w-3.5 h-3.5 text-muted-foreground shrink-0";
  if (kind === "session") return <MessageSquare className={cls} />;
  if (kind === "journal") return <PenLine className={cls} />;
  return <CalendarClock className={cls} />;
}

export default function Caregiver() {
  const [selectedId, setSelectedId] = useState<string>(PATIENTS[0].id);
  const selected = PATIENTS.find((p) => p.id === selectedId)!;

  const totalFlags = PATIENTS.reduce((s, p) => s + p.safetyFlags14d, 0);
  const avgEngagement = Math.round(
    (PATIENTS.reduce((s, p) => s + p.engagement, 0) / PATIENTS.length) * 100,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
              <Logo variant="lockup" size={40} />
            </div>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <CaregiverAccountNav />
          </nav>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-12 md:py-16 space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-4 max-w-3xl"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Caregiver portal — preview with sample data
          </p>
          <h1 className="text-3xl md:text-4xl font-serif leading-tight">
            See how the people you walk with are doing.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            With each person&apos;s logged consent, MeaningBridge gives you a quiet, honest read
            on their grief between sessions — engagement, the shape of their writing, any safety
            signals — so you can step in when it matters. You stay in the lead.
          </p>
        </motion.section>

        <section className="grid sm:grid-cols-3 gap-4">
          <StatCard label="People you walk with" value={String(PATIENTS.length)} hint="active in the past 14 days" />
          <StatCard
            label="Safety signals"
            value={String(totalFlags)}
            hint="across the past 14 days"
            accent={totalFlags > 0}
          />
          <StatCard label="Average engagement" value={`${avgEngagement}%`} hint="sessions and journal" />
        </section>

        <section className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Your roster</h2>
              <span className="text-xs text-muted-foreground">Sorted by recent activity</span>
            </div>
            <div className="divide-y divide-border/60">
              {PATIENTS.map((p) => {
                const isSelected = p.id === selectedId;
                const tier = TIER_META[p.tier];
                const ConsentIcon = CONSENT_META[p.consent].icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-5 py-4 grid grid-cols-12 items-center gap-3 hover:bg-muted/30 transition-colors ${
                      isSelected ? "bg-muted/40" : ""
                    }`}
                  >
                    <div className="col-span-4 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.firstName} {p.lastInitial}.
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.lossSummary} · {p.monthsSinceLoss} mo
                      </p>
                    </div>
                    <div className="col-span-3">
                      <span className={`inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded ${tier.tone}`}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">
                      {p.lastActivity}
                    </div>
                    <div className="col-span-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <ConsentIcon
                        className={`w-3.5 h-3.5 ${p.consent === "active" ? "text-primary/70" : ""}`}
                      />
                      <span className="truncate">{CONSENT_META[p.consent].label.replace("Consent ", "")}</span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {p.safetyFlags14d > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {p.safetyFlags14d}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
                {selected.lossSummary} · {selected.monthsSinceLoss} months since loss
              </p>
              <div className="flex items-center gap-2 pt-2">
                <span
                  className={`inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded ${TIER_META[selected.tier].tone}`}
                >
                  {TIER_META[selected.tier].label}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {CONSENT_META[selected.consent].label}
                </span>
              </div>
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
                Engagement (14 days)
              </p>
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full transition-all"
                    style={{ width: `${selected.engagement * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(selected.engagement * 100)}% of typical pace
                </p>
              </div>
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
                    {selected.safetyFlags14d > 1 ? "s" : ""} in the past 14 days. The companion
                    paused normal flow and surfaced crisis resources.
                  </p>
                </div>
              )}
            </div>

            {selected.consent === "active" ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Briefing for your next session
                </p>
                <p className="text-sm text-foreground/90 italic leading-relaxed border-l-2 border-border pl-3">
                  {selected.summary}
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                Session briefing is private until {selected.firstName} grants consent. You can
                request access from this profile.
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
                <CalendarClock className="w-4 h-4" />
                Request consult
              </button>
              <button className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-md border border-border text-sm hover:border-foreground transition-colors">
                <MessageSquare className="w-4 h-4" />
                Send a note
              </button>
            </div>
          </motion.aside>
        </section>

        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-2xl border border-border bg-card p-10 md:p-12 grid md:grid-cols-3 gap-8"
        >
          <div className="md:col-span-1 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Why caregivers join
            </p>
            <h3 className="text-xl font-serif leading-snug">
              MeaningBridge holds the space between sessions — so you can hold the space inside
              them.
            </h3>
          </div>
          <div className="md:col-span-2 grid sm:grid-cols-2 gap-6">
            <Pillar icon={Activity} title="Continuity of care">
              Read what shifted since you last met, written by them, never by us.
            </Pillar>
            <Pillar icon={ShieldAlert} title="Safety, surfaced gently">
              Validated screeners flag what asks for a human, not what looks dramatic.
            </Pillar>
            <Pillar icon={CheckCircle2} title="Consent is the floor">
              Nothing reaches you without their logged consent. Nothing.
            </Pillar>
            <Pillar icon={CalendarClock} title="Light on your week">
              No new EHR. A roster, a briefing, a tap to consult.
            </Pillar>
          </div>
        </motion.section>

        <section className="text-center pb-8">
          <Link
            href="/notify?src=caregiver-preview"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Join the caregiver waitlist
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground">
        Preview — sample data shown for demonstration. No real patient information.
      </footer>
    </div>
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
      <p className={`mt-2 text-3xl font-serif ${accent ? "text-destructive" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Pillar({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CheckCircle2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary/70" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
