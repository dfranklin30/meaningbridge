import { Link } from "wouter";
import { format } from "date-fns";
import { useListGmriResults } from "@workspace/api-client-react";
import { Compass, ArrowRight } from "lucide-react";

function lastTaken(dates: string | undefined): string {
  if (!dates) return "Not yet explored";
  return `Last explored ${format(new Date(dates), "MMMM d, yyyy")}`;
}

export default function Reflections() {
  const { data: gmri } = useListGmriResults();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">Reflections</h1>
        <p className="text-muted-foreground leading-relaxed max-w-xl">
          These are gentle, research-grounded self-reflections you can return to
          over time. They are not tests, and there are no right answers — only a
          way to notice where you are, and to see it mirrored back with care.
        </p>
      </div>

      <div className="space-y-5">
        <ReflectionCard
          href="/reflections/gmri"
          icon={<Compass className="w-5 h-5" />}
          title="Grief and meaning"
          subtitle="Grief & Meaning Reconstruction Inventory"
          description="Twenty-nine short statements about connection, growth, peace, and the way meaning is slowly remade. Afterward you will see a warm portrait across five themes."
          meta={lastTaken(gmri?.[0]?.completedAt)}
          cta={gmri && gmri.length > 0 ? "Reflect again" : "Begin"}
        />
      </div>

      <p className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border/50 pt-6">
        This inventory is offered here as a reflection to sit with, not as a
        diagnosis. What it means is yours to decide.
      </p>
    </div>
  );
}

function ReflectionCard({
  href,
  icon,
  title,
  subtitle,
  description,
  meta,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  meta: string;
  cta: string;
}) {
  return (
    <Link href={href}>
      <div className="group block bg-card hover:bg-secondary/20 border border-border rounded-xl p-6 transition-colors cursor-pointer space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform duration-500">
            {icon}
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl text-foreground">{title}</h2>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
              {subtitle}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground/80">{meta}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            {cta}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}
