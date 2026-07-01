import { Link } from "wouter";
import { useListPractices } from "@workspace/api-client-react";
import { Play, Wind, Edit3, Heart, Eye, Plus, Pencil } from "lucide-react";

export default function PracticesList() {
  const { data: practices } = useListPractices();

  const getIcon = (category: string) => {
    switch (category) {
      case 'breathwork': return <Wind className="w-4 h-4" />;
      case 'art': return <Edit3 className="w-4 h-4" />;
      case 'ritual': return <Heart className="w-4 h-4" />;
      case 'reflection': return <Eye className="w-4 h-4" />;
      default: return <Play className="w-4 h-4" />;
    }
  };

  const grouped = practices?.reduce((acc, practice) => {
    if (!acc[practice.category]) acc[practice.category] = [];
    acc[practice.category].push(practice);
    return acc;
  }, {} as Record<string, typeof practices>);

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-serif text-foreground">Practices</h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Gentle exercises to help ground your body, process your emotions, or create meaningful rituals of remembrance.
          </p>
        </div>
        <Link
          href="/practices/new"
          className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New practice
        </Link>
      </div>

      <div className="space-y-10">
        {grouped && Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="space-y-4">
            <h2 className="text-xl font-serif capitalize flex items-center gap-2">
              {category}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {items.map(practice => (
                <div
                  key={practice.id}
                  className="group bg-card border border-border p-5 rounded-xl hover:bg-secondary/20 transition-all h-full flex flex-col relative"
                >
                  <Link
                    href={`/practices/${practice.id}/edit`}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors z-10"
                    aria-label={`Edit ${practice.title}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <Link href={`/practices/${practice.id}`} className="flex flex-col flex-1 cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {getIcon(category)}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded mr-9">
                        {practice.durationMinutes} min
                      </span>
                    </div>
                    <h3 className="font-medium text-lg mb-2 group-hover:text-primary transition-colors">{practice.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {practice.summary}
                    </p>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
