import { Link } from "wouter";
import {
  useListCheckIns,
  useGetDashboardSummary,
  useGetDashboardTrends,
  useGetProfile,
} from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TIER_LABELS, TIER_NARRATIVE, type Tier } from "../lib/clinical";
import { CalendarClock, MessageSquare, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary();
  const { data: trends } = useGetDashboardTrends();
  const { data: profile } = useGetProfile();
  const tier = (profile?.tier ?? null) as Tier | null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-serif text-foreground">Insights</h1>

      {tier && (
        <div className="bg-card border border-border p-6 rounded-xl space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            How this space is meeting you
          </p>
          <p className="text-lg font-serif text-foreground">{TIER_LABELS[tier]}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{TIER_NARRATIVE[tier]}</p>
        </div>
      )}

      {(tier === "targeted" || tier === "clinical") && <CareTeamCard tier={tier} />}
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-card border border-border p-6 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Check-ins</p>
          <p className="text-3xl font-serif mt-2">{summary?.checkInCount || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Journal Entries</p>
          <p className="text-3xl font-serif mt-2">{summary?.journalCount || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Conversations</p>
          <p className="text-3xl font-serif mt-2">{summary?.sessionCount || 0}</p>
        </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-xl space-y-6">
        <h2 className="text-xl font-serif">Your Path Over Time</h2>
        <div className="h-64">
          {trends?.points && trends.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.points}>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="distress" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="meaning" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Not enough data to show trends yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CareTeamCard({ tier }: { tier: "targeted" | "clinical" }) {
  // Placeholder team member — to be wired to a real caregiver match in v2.
  const caregiver =
    tier === "clinical"
      ? {
          name: "Dr. Elena Marsh",
          credential: "PhD, Licensed Grief Therapist",
          line: "Your next session is Thursday at 4:00 pm.",
          ctaPrimary: "Open this week's session",
          ctaSecondary: "Message Elena",
        }
      : {
          name: "Jamie Okafor",
          credential: "Grief Educator",
          line: "Jamie checks in on Sundays, and is here when you want them.",
          ctaPrimary: "Send a check-in note",
          ctaSecondary: "See group times",
        };

  return (
    <div className="bg-card border border-border p-6 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Your care team</p>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-2 py-0.5">
          Preview
        </span>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-serif text-lg">
          {caregiver.name.split(" ").slice(-1)[0]?.[0] ?? "C"}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-serif text-lg text-foreground">{caregiver.name}</p>
          <p className="text-xs text-muted-foreground">{caregiver.credential}</p>
          <p className="text-sm text-muted-foreground italic leading-relaxed pt-1">
            {caregiver.line}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        Sample care team shown for the {tier === "clinical" ? "Specialist" : "Enhanced"} plan.
        Real matching and messaging are not yet live.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary/40 text-primary-foreground text-sm cursor-not-allowed"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          {caregiver.ctaPrimary}
        </button>
        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-muted-foreground cursor-not-allowed"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {caregiver.ctaSecondary}
        </button>
        <Link
          href="/pricing"
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View plans
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}