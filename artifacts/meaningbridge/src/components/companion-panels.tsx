import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCompanionMemory,
  useAddCompanionMemory,
  useDeleteCompanionMemory,
  getListCompanionMemoryQueryKey,
  useListCompanionTasks,
  useCreateCompanionTask,
  useUpdateCompanionTask,
  getListCompanionTasksQueryKey,
  useListPractices,
  getListPracticesQueryKey,
} from "@workspace/api-client-react";
import type { CompanionTask } from "@workspace/api-client-react";
import { Sparkles, Plus, X, Check, Leaf } from "lucide-react";

// The two durable surfaces of the patient companion: what it remembers about
// the person, and the gentle practices it has invited them into. Both are calm,
// editable, and never scored.
export function CompanionPanels() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <MemoryPanel />
      <TasksPanel />
    </div>
  );
}

function MemoryPanel() {
  const queryClient = useQueryClient();
  const { data: memories } = useListCompanionMemory({
    query: { queryKey: getListCompanionMemoryQueryKey() },
  });
  const { mutateAsync: addMemory, isPending: adding } = useAddCompanionMemory();
  const { mutateAsync: deleteMemory } = useDeleteCompanionMemory();
  const [draft, setDraft] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCompanionMemoryQueryKey() });

  const submit = async () => {
    const content = draft.trim();
    if (!content || adding) return;
    await addMemory({ data: { content } });
    setDraft("");
    invalidate();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-serif text-lg">What your companion remembers</h2>
          <p className="text-xs text-muted-foreground">
            Details it carries between conversations. You are always in control of this.
          </p>
        </div>
      </div>

      {memories && memories.length > 0 ? (
        <ul className="space-y-2">
          {memories.map((m) => (
            <li
              key={m.id}
              className="group flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5"
            >
              <span className="text-sm leading-relaxed">{m.content}</span>
              <button
                type="button"
                onClick={async () => {
                  await deleteMemory({ id: m.id });
                  invalidate();
                }}
                aria-label="Remove this memory"
                className="shrink-0 text-muted-foreground/60 hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing here yet. As you talk, your companion will gently note what matters to you, and
          you can add your own notes below.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Add something you would like remembered"
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={adding || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </section>
  );
}

function TasksPanel() {
  const queryClient = useQueryClient();
  const { data: tasks } = useListCompanionTasks({
    query: { queryKey: getListCompanionTasksQueryKey() },
  });
  const { mutateAsync: createTask, isPending: creating } = useCreateCompanionTask();
  const { mutateAsync: updateTask } = useUpdateCompanionTask();
  const { data: practices } = useListPractices({
    query: { queryKey: getListPracticesQueryKey() },
  });
  const [draft, setDraft] = useState("");

  // Companion tasks carry a practice *slug*, but the practice player is keyed by
  // numeric id. Resolve the slug to an id so the deep-link opens the real
  // practice; hide the link when the slug has no matching practice.
  const practiceIdBySlug = (slug: string): number | undefined =>
    practices?.find((p) => p.slug === slug)?.id;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCompanionTasksQueryKey() });

  const open = (tasks ?? []).filter(
    (t) => t.status === "suggested" || t.status === "active",
  );

  const setStatus = async (t: CompanionTask, status: CompanionTask["status"]) => {
    await updateTask({ id: t.id, data: { status } });
    invalidate();
  };

  const submit = async () => {
    const title = draft.trim();
    if (!title || creating) return;
    await createTask({ data: { title, status: "active" } });
    setDraft("");
    invalidate();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Leaf className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-serif text-lg">Gentle invitations</h2>
          <p className="text-xs text-muted-foreground">
            Small practices your companion has offered. There is no obligation to any of them.
          </p>
        </div>
      </div>

      {open.length > 0 ? (
        <ul className="space-y-3">
          {open.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-border/70 bg-background p-3.5 space-y-2.5"
            >
              <div className="flex items-start gap-2">
                {t.status === "suggested" && (
                  <span className="mt-0.5 text-[10px] uppercase tracking-wider text-primary/80">
                    Suggested
                  </span>
                )}
              </div>
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              {t.body && (
                <p className="text-xs text-muted-foreground leading-relaxed">{t.body}</p>
              )}
              {t.practiceSlug && practiceIdBySlug(t.practiceSlug) !== undefined && (
                <Link
                  href={`/practices/${practiceIdBySlug(t.practiceSlug)}`}
                  className="inline-block text-xs text-primary hover:underline underline-offset-4"
                >
                  Open this practice
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {t.status === "suggested" && (
                  <button
                    type="button"
                    onClick={() => setStatus(t, "active")}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-foreground transition-colors"
                  >
                    Keep this
                  </button>
                )}
                {t.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setStatus(t, "completed")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-foreground transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark as tended
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStatus(t, "dismissed")}
                  className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Set aside
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No invitations right now. When something in a conversation might help, your companion will
          offer it here.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Add your own intention"
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={creating || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </section>
  );
}
