import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useSubmitGmri,
  useListGmriResults,
  getListGmriResultsQueryKey,
  type GmriResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  GMRI_ITEMS,
  GMRI_SCALE,
  GMRI_INSTRUCTIONS,
  GMRI_FACTORS,
  GMRI_FACTOR_ORDER,
  gmriBand,
  type GmriFactorKey,
} from "../../lib/clinical";
import { InventoryRunner } from "../../components/inventory-runner";

export default function GmriPage() {
  const queryClient = useQueryClient();
  const { data: history } = useListGmriResults();
  const { mutateAsync: submit, isPending } = useSubmitGmri();
  const [result, setResult] = useState<GmriResult | null>(null);
  const [started, setStarted] = useState(false);

  const handleComplete = async (responses: number[]) => {
    const res = await submit({ data: { responses } });
    queryClient.invalidateQueries({ queryKey: getListGmriResultsQueryKey() });
    setResult(res);
  };

  if (result) {
    return <GmriResultView result={result} onRetake={() => { setResult(null); setStarted(true); }} />;
  }

  if (!started) {
    return (
      <GmriIntro
        hasHistory={!!history && history.length > 0}
        onStart={() => setStarted(true)}
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-serif">Grief and meaning</h1>
      </div>
      <InventoryRunner
        items={GMRI_ITEMS}
        scale={GMRI_SCALE}
        instructions={GMRI_INSTRUCTIONS}
        onComplete={handleComplete}
        submitting={isPending}
      />
    </div>
  );
}

function GmriIntro({ hasHistory, onStart }: { hasHistory: boolean; onStart: () => void }) {
  const [companionIntro, setCompanionIntro] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}api/companion/reflection-intro?exercise=gmri`,
          { credentials: "include" },
        );
        if (res.ok) {
          const data = (await res.json()) as { intro?: string };
          if (active && data.intro) setCompanionIntro(data.intro);
        }
      } catch {
        // The companion's intro is a warm extra; the reflection stands without it.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-6 py-8">
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
          Grief &amp; Meaning Reconstruction Inventory
        </p>
        <h1 className="text-3xl font-serif text-foreground">Grief and meaning</h1>
        <p className="text-muted-foreground leading-relaxed">
          {GMRI_INSTRUCTIONS} It takes a few unhurried minutes. You can pause and
          go back at any time. When you finish, you will see a gentle portrait of
          where you are across five themes of grieving.
        </p>
      </div>

      {companionIntro && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/80 leading-relaxed font-serif italic">
          {companionIntro}
        </div>
      )}
      <div className="flex items-center gap-4">
        <button
          onClick={onStart}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          {hasHistory ? "Reflect again" : "Begin"}
        </button>
        <Link href="/reflections" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Back to reflections
        </Link>
      </div>
    </div>
  );
}

function GmriResultView({ result, onRetake }: { result: GmriResult; onRetake: () => void }) {
  const [, setLocation] = useLocation();
  const factors = result.factors as Record<GmriFactorKey, number>;

  const radarData = GMRI_FACTOR_ORDER.map((key) => ({
    factor: GMRI_FACTORS[key].label,
    value: factors[key] ?? 0,
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-serif">Your reflection</h1>
        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
          This is a portrait, not a verdict. Grief moves; a portrait taken next
          week may look different. Take what feels true and leave the rest.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-card border border-border rounded-xl p-4 md:p-6"
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="factor"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <PolarRadiusAxis domain={[1, 5]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.25}
                isAnimationActive
                animationDuration={900}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="space-y-4">
        {GMRI_FACTOR_ORDER.map((key, i) => {
          const mean = factors[key] ?? 0;
          const band = gmriBand(mean);
          const f = GMRI_FACTORS[key];
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 * i }}
              className="bg-card border border-border rounded-xl p-5 space-y-2"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-lg text-foreground">{f.label}</h3>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  {f.short}
                </span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{f[band]}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-secondary/20 border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm text-foreground/90 leading-relaxed">
          If any of this stirred something, the companion is here to sit with it —
          to explore the bond you carry, or the meaning you are slowly remaking.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/companion"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Talk with the companion
          </Link>
          <Link
            href="/journal/new"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Write in your journal
          </Link>
        </div>
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
