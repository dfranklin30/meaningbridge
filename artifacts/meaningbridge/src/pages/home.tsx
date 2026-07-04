import { Link } from "wouter";
import { useGetProfile, useListCheckIns, useGetDashboardSummary } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Feather, BookOpen, Wind, Compass } from "lucide-react";
import { WelcomeTour } from "@/components/welcome-tour";

export default function Home() {
  const { data: profile } = useGetProfile();
  const { data: checkIns } = useListCheckIns();
  const { data: summary } = useGetDashboardSummary();

  // First entrance after onboarding: step the person through the app once.
  const showWelcomeTour = Boolean(
    profile && profile.onboardingComplete && !profile.welcomeTourSeen,
  );

  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";

  const today = format(new Date(), "yyyy-MM-dd");
  const hasCheckedInToday = checkIns?.some(c => c.createdAt.startsWith(today));

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      {showWelcomeTour && (
        <WelcomeTour firstName={profile?.firstName ?? profile?.name ?? null} />
      )}
      <section className="space-y-4 text-center mt-8">
        <h1 className="text-3xl md:text-4xl text-foreground font-medium">
          {greeting}{profile?.name ? `, ${profile.name}` : ""}.
        </h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
          This is a quiet space for your grief. Take what you need today.
        </p>
      </section>

      {!hasCheckedInToday && (
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm text-center space-y-4">
          <h2 className="font-serif text-xl">How are you carrying things today?</h2>
          <p className="text-sm text-muted-foreground">A gentle check-in to see where you are.</p>
          <div className="pt-2">
            <Link href="/checkin" className="inline-flex items-center justify-center h-10 px-6 font-medium bg-primary text-primary-foreground rounded-md shadow hover:opacity-90 transition-opacity">
              Take a moment to check in
            </Link>
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/companion">
          <div className="group block bg-card hover:bg-secondary/20 border border-border rounded-xl p-6 transition-colors cursor-pointer space-y-3 h-full">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-500">
              <Feather className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-xl">Companion</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Converse with a reflective guide to explore meaning, or maintain a sense of connection.
            </p>
          </div>
        </Link>

        <Link href="/journal">
          <div className="group block bg-card hover:bg-secondary/20 border border-border rounded-xl p-6 transition-colors cursor-pointer space-y-3 h-full">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-500">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-xl">Journal</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A private space to write, remember, and process what you are feeling.
            </p>
          </div>
        </Link>

        <Link href="/reflections">
          <div className="group block bg-card hover:bg-secondary/20 border border-border rounded-xl p-6 transition-colors cursor-pointer space-y-3 h-full">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-500">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-xl">Reflections</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Gentle, research-grounded self-reflections on meaning and the rhythm
              of grieving, mirrored back with care.
            </p>
          </div>
        </Link>
      </div>

      {summary?.suggestedPractices && summary.suggestedPractices.length > 0 && (
        <section className="space-y-6 pt-6 border-t border-border/50">
          <h2 className="font-serif text-2xl text-center">Suggested for you</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {summary.suggestedPractices.slice(0, 2).map((practice) => (
              <Link key={practice.id} href={`/practices/${practice.id}`}>
                <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">{practice.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{practice.summary}</p>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-2 block">
                      {practice.durationMinutes} min • {practice.category}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}