import { useState } from "react";
import { Link } from "wouter";
import { useListJournalEntries, useListJournalPrompts } from "@workspace/api-client-react";
import { Search, Plus, PenTool } from "lucide-react";
import { format } from "date-fns";

export default function JournalList() {
  const { data: entries } = useListJournalEntries();
  const { data: prompts } = useListJournalPrompts();
  const [search, setSearch] = useState("");

  const promptOfTheDay = prompts && prompts.length > 0 
    ? prompts[new Date().getDate() % prompts.length] 
    : null;

  const filteredEntries = entries?.filter(e => 
    e.title.toLowerCase().includes(search.toLowerCase()) || 
    e.body.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-foreground">Journal</h1>
          <p className="text-muted-foreground">A private space for your memories and processing.</p>
        </div>
        <Link href="/journal/new" className="inline-flex items-center justify-center h-10 px-4 gap-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity shrink-0">
          <Plus className="w-4 h-4" /> New Entry
        </Link>
      </div>

      {promptOfTheDay && (
        <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
            <PenTool className="w-32 h-32 transform translate-x-8 -translate-y-8" />
          </div>
          <p className="text-xs text-primary font-medium tracking-wider uppercase mb-3">Prompt of the day</p>
          <h3 className="text-xl font-serif mb-4 max-w-2xl">{promptOfTheDay.prompt}</h3>
          <Link href={`/journal/new?promptId=${promptOfTheDay.id}`} className="text-sm font-medium text-primary underline underline-offset-4">
            Write about this
          </Link>
        </div>
      )}

      <div className="space-y-6 pt-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search entries..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary/50 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredEntries?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No entries found.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredEntries?.map(entry => (
              <Link key={entry.id} href={`/journal/${entry.id}`}>
                <div className="group bg-card hover:bg-secondary/20 border border-border p-5 rounded-lg transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-serif text-lg group-hover:text-primary transition-colors">{entry.title}</h3>
                    <span className="text-xs text-muted-foreground shrink-0">{format(new Date(entry.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {entry.body.replace(/[#*`_]/g, '')}
                  </p>
                  <div className="mt-4 inline-block px-2.5 py-1 bg-secondary rounded text-[10px] uppercase tracking-wider text-secondary-foreground/70">
                    {entry.category}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}