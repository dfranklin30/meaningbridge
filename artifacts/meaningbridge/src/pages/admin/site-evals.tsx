import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, ShieldCheck, Lock } from "lucide-react";
import type { SandboxFeedback } from "@workspace/api-client-react";
import { Logo } from "@/components/logo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const TOKEN_KEY = "mb-admin-token";

// Canonical site-evaluation dimensions (0-10). Kept in sync with the server's
// EVAL_DIMENSIONS in artifacts/api-server/src/routes/feedback.ts and the sliders
// in pages/evaluate.tsx.
const DIMENSIONS: { key: string; label: string }[] = [
  { key: "navigation", label: "Ease of navigation" },
  { key: "aesthetics", label: "Aesthetics" },
  { key: "tone", label: "Tone of language for grievers" },
  { key: "relevance", label: "Relevance of features offered" },
  { key: "helpfulness", label: "Perceived helpfulness to bereaved users" },
  { key: "fidelity", label: "Fidelity to the voice of the deceased" },
  { key: "continuingBonds", label: "Continuing bonds" },
  { key: "meaningfulness", label: "Meaningfulness" },
  { key: "emotionalImpact", label: "Emotional impact" },
  { key: "therapistValue", label: "Helpfulness of features to therapists" },
  { key: "trust", label: "Trust and sense of safety" },
  { key: "easeOfUse", label: "Overall ease of use" },
  { key: "recommend", label: "Likelihood to recommend" },
];

interface DimensionSummary {
  key: string;
  label: string;
  average: number | null;
  count: number;
  comments: { name: string; comment: string; createdAt: string }[];
}

function displayName(row: SandboxFeedback): string {
  return row.name?.trim() || row.roleLabel?.trim() || "Anonymous";
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(rows: SandboxFeedback[]): string {
  const header = [
    "id",
    "submitted_at",
    "name",
    "role",
    "role_label",
    "consent_to_share",
    ...DIMENSIONS.flatMap((d) => [`${d.key}_score`, `${d.key}_comment`]),
    "time_spent",
    "additional_suggestions",
    "narrative",
  ];
  const lines = rows.map((row) => {
    const cells: (string | number | null | undefined)[] = [
      row.id,
      row.createdAt,
      row.name ?? "",
      row.role ?? "",
      row.roleLabel ?? "",
      row.consentToShare ? "yes" : "no",
    ];
    for (const d of DIMENSIONS) {
      cells.push(row.ratings?.[d.key] ?? "");
      cells.push(row.comments?.[d.key] ?? "");
    }
    cells.push(row.comments?.timeSpent ?? "");
    cells.push(row.additionalSuggestions ?? "");
    cells.push(row.narrative ?? "");
    return cells.map(csvCell).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

export default function AdminSiteEvals() {
  const [token, setToken] = useState<string>(
    () => sessionStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [draftToken, setDraftToken] = useState("");
  const [rows, setRows] = useState<SandboxFeedback[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await fetch(`${basePath}/api/feedback`, {
        headers: { "x-admin-token": t },
      });
      if (res.status === 403) {
        setForbidden(true);
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = (await res.json()) as SandboxFeedback[];
      setRows(data.filter((r) => r.source === "site-eval"));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load the evaluations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  const summaries = useMemo<DimensionSummary[]>(() => {
    if (!rows) return [];
    return DIMENSIONS.map((d) => {
      const scored = rows
        .map((r) => r.ratings?.[d.key])
        .filter((v): v is number => typeof v === "number");
      const comments = rows
        .filter((r) => r.comments?.[d.key]?.trim())
        .map((r) => ({
          name: displayName(r),
          comment: r.comments![d.key]!.trim(),
          createdAt: r.createdAt,
        }));
      return {
        key: d.key,
        label: d.label,
        average: scored.length
          ? scored.reduce((a, b) => a + b, 0) / scored.length
          : null,
        count: scored.length,
        comments,
      };
    });
  }, [rows]);

  const suggestions = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.additionalSuggestions?.trim())
        .map((r) => ({
          id: r.id,
          name: displayName(r),
          text: r.additionalSuggestions!.trim(),
          createdAt: r.createdAt,
        })),
    [rows],
  );

  const handleExport = () => {
    if (!rows || rows.length === 0) return;
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-evaluations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Token gate — the review view reuses the x-admin-token pattern from GET /feedback.
  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground font-sans flex items-center justify-center px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = draftToken.trim();
            if (!t) return;
            sessionStorage.setItem(TOKEN_KEY, t);
            setToken(t);
          }}
          className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 text-center"
        >
          <div className="mx-auto w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-serif text-2xl">Site evaluations</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enter the admin token to read submitted evaluations.
            </p>
          </div>
          {forbidden && (
            <p className="text-sm text-destructive">
              That token was not accepted. Please try again.
            </p>
          )}
          <input
            type="password"
            value={draftToken}
            onChange={(e) => setDraftToken(e.target.value)}
            placeholder="Admin token"
            autoFocus
            className="input"
          />
          <button type="submit" className="btn-primary w-full py-2.5">
            View evaluations
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return home
          </Link>
        </form>
      </div>
    );
  }

  const totalSubmissions = rows?.length ?? 0;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      <header className="border-b border-border/60">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link href="/">
            <Logo variant="lockup" size={40} />
          </Link>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(TOKEN_KEY);
              setToken("");
              setRows(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary/80">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs uppercase tracking-[0.2em]">
                Admin review
              </span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl">Site evaluations</h1>
            <p className="text-muted-foreground">
              {totalSubmissions === 0
                ? "No evaluations have been submitted yet."
                : `${totalSubmissions} evaluation${totalSubmissions === 1 ? "" : "s"} received. Averages are on a 0–10 scale.`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={totalSubmissions === 0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-border text-sm hover:border-foreground transition-colors shrink-0 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            Loading evaluations…
          </p>
        ) : totalSubmissions === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            Evaluations submitted from the site will appear here.
          </p>
        ) : (
          <>
            <section className="grid sm:grid-cols-2 gap-3">
              {summaries.map((s) => (
                <div
                  key={s.key}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">{s.label}</p>
                    <span className="font-serif text-2xl text-primary tabular-nums shrink-0">
                      {s.average != null ? s.average.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{
                        width:
                          s.average != null
                            ? `${(s.average / 10) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {s.count} rating{s.count === 1 ? "" : "s"}
                    {s.comments.length > 0 &&
                      ` · ${s.comments.length} comment${s.comments.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              ))}
            </section>

            <section className="space-y-6">
              <h2 className="font-serif text-2xl">Comments by dimension</h2>
              {summaries.every((s) => s.comments.length === 0) ? (
                <p className="text-sm text-muted-foreground">
                  No comments have been left yet.
                </p>
              ) : (
                summaries
                  .filter((s) => s.comments.length > 0)
                  .map((s) => (
                    <div key={s.key} className="space-y-3">
                      <h3 className="text-sm font-medium text-foreground/80">
                        {s.label}
                      </h3>
                      <div className="space-y-2">
                        {s.comments.map((c, i) => (
                          <div
                            key={`${s.key}-${i}`}
                            className="rounded-xl border border-border bg-card px-4 py-3"
                          >
                            <p className="text-sm leading-relaxed">
                              {c.comment}
                            </p>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {c.name} ·{" "}
                              {new Date(c.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </section>

            <section className="space-y-4">
              <h2 className="font-serif text-2xl">Additional suggestions</h2>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No additional suggestions have been shared yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {s.text}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {s.name} · {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
