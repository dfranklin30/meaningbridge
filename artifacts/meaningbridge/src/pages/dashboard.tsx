import { Link } from "wouter";
import {
  useListCheckIns,
  useGetDashboardSummary,
  useGetDashboardTrends,
  useGetProfile,
  useListGmriResults,
  type GmriResult,
} from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  TIER_LABELS,
  TIER_NARRATIVE,
  type Tier,
  GMRI_FACTORS,
  GMRI_FACTOR_ORDER,
  type GmriFactorKey,
} from "../lib/clinical";
import { ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary();
  const { data: trends } = useGetDashboardTrends();
  const { data: profile } = useGetProfile();
  const { data: gmri } = useListGmriResults();
  const tier = (profile?.tier ?? null) as Tier | null;
  const latestGmri = gmri?.[0] ?? null;

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

      {latestGmri && (
        <div className="grid gap-6">
          <GmriSnapshot result={latestGmri} />
        </div>
      )}

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

function GmriSnapshot({ result }: { result: GmriResult }) {
  const factors = result.factors as Record<GmriFactorKey, number>;
  const data = GMRI_FACTOR_ORDER.map((key) => ({
    factor: GMRI_FACTORS[key].label,
    value: factors[key] ?? 0,
  }));
  return (
    <Link href="/reflections/gmri">
      <div className="bg-card border border-border p-6 rounded-xl space-y-3 h-full hover:bg-secondary/10 transition-colors cursor-pointer">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Grief and meaning</p>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="70%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="factor"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <PolarRadiusAxis domain={[1, 5]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.25}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Link>
  );
}

function CareTeamCard({ tier }: { tier: "targeted" | "clinical" }) {
  const plan = tier === "clinical" ? "Specialist" : "Enhanced";

  return (
    <div className="bg-card border border-border p-6 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Your care team</p>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-2 py-0.5">
          Coming soon
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        When you are matched with a care team member on the {plan} plan, they will appear here —
        with a gentle way to reach them between sessions. Human matching and messaging are not
        live yet.
      </p>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View plans
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}