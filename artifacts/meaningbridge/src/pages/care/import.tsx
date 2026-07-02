import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Upload,
  Download,
  FileSpreadsheet,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  api,
  ApiError,
  Spinner,
  ErrorBanner,
  PhiNotice,
  useTwoFactorGate,
} from "./provider-shell";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = basePath + "/api";

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

interface ParseResponse {
  filename: string;
  source: "csv" | "xlsx";
  headers: string[];
  rows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

interface RowReport {
  row: number;
  ok: boolean;
  reason?: string;
  name: string | null;
}

interface ValidateResponse {
  report: RowReport[];
  acceptedCount: number;
  rejectedCount: number;
}

interface CommitResponse extends ValidateResponse {
  import: BatchImportView;
}

interface BatchImportView {
  id: number;
  filename: string | null;
  source: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  report: { row: number; ok: boolean; reason?: string }[] | null;
  createdAt: string;
}

const CANONICAL_KEYS = ["firstName", "lastName", "email", "phone", "dob", "pronouns"] as const;
type CanonicalKey = (typeof CANONICAL_KEYS)[number];

type Step = "upload" | "map" | "review" | "done";

/** Guarded multipart upload — mirrors the JSON `api` helper but for a File. */
async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(body?.error || `Upload failed (${res.status})`, res.status, body?.code ?? null);
  }
  return (await res.json()) as T;
}

export default function ProviderImport() {
  const { guard, challengeElement } = useTwoFactorGate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [phiCode, setPhiCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fields, setFields] = useState<FieldDef[]>([]);
  const [maxRows, setMaxRows] = useState(500);
  const [history, setHistory] = useState<BatchImportView[]>([]);

  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [committed, setCommitted] = useState<CommitResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPhiCode(null);
    setError(null);
    try {
      const [meta, imports] = await Promise.all([
        guard(() => api<{ fields: FieldDef[]; maxRows: number }>("/professional/batch-imports/fields")),
        guard(() => api<BatchImportView[]>("/professional/batch-imports")),
      ]);
      setFields(meta.fields);
      setMaxRows(meta.maxRows);
      setHistory(imports);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) setPhiCode(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not open bulk import.");
    } finally {
      setLoading(false);
    }
  }, [guard]);

  useEffect(() => {
    void load();
  }, [load]);

  function downloadTemplate() {
    window.location.href = `${API}/professional/batch-imports/template`;
  }

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const res = await guard(() => uploadFile<ParseResponse>("/professional/batch-imports/parse", file));
      setParsed(res);
      setMapping(res.suggestedMapping);
      setStep("map");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code === "two_factor_challenge_required") {
        // guard handles the retry; nothing to show.
      } else {
        setError(err instanceof Error ? err.message : "We could not read that file.");
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Build canonical rows from the parsed rows + current column mapping. */
  function toCanonicalRows(): Record<CanonicalKey, string>[] {
    if (!parsed) return [];
    return parsed.rows.map((raw) => {
      const out = {} as Record<CanonicalKey, string>;
      for (const key of CANONICAL_KEYS) {
        const header = mapping[key];
        out[key] = header ? (raw[header] ?? "").trim() : "";
      }
      return out;
    });
  }

  async function runValidate() {
    setError(null);
    setBusy(true);
    try {
      const rows = toCanonicalRows();
      const res = await guard(() =>
        api<ValidateResponse>("/professional/batch-imports/validate", {
          method: "POST",
          body: JSON.stringify({ rows }),
        }),
      );
      setValidation(res);
      setStep("review");
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not validate these rows.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (!parsed) return;
    setError(null);
    setBusy(true);
    try {
      const rows = toCanonicalRows();
      const res = await guard(() =>
        api<CommitResponse>("/professional/batch-imports/commit", {
          method: "POST",
          body: JSON.stringify({ filename: parsed.filename, source: parsed.source, rows }),
        }),
      );
      setCommitted(res);
      setStep("done");
      void load();
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not complete the import.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setParsed(null);
    setMapping({});
    setValidation(null);
    setCommitted(null);
    setError(null);
    setStep("upload");
  }

  const requiredUnmapped = fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);

  if (loading) return <Spinner />;
  if (phiCode) return <PhiNotice code={phiCode} onChallenge={() => window.location.reload()} />;

  return (
    <div className="space-y-8">
      {challengeElement}

      <div className="space-y-1">
        <Link href="/care/patients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to patients
        </Link>
        <h1 className="font-serif text-3xl">Bulk enrollment</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Upload a spreadsheet of clients to enroll them together. Each valid row receives the same
          gentle consent invite as an individually enrolled patient. You can upload up to {maxRows}{" "}
          at a time. Detailed intake is completed per patient afterwards.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {step === "upload" && (
        <section className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                <Download className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h2 className="font-serif text-lg">Start with the template</h2>
                <p className="text-sm text-muted-foreground">
                  The columns match the fields we ask for at intake. Fill in one client per row.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-12 text-xs text-muted-foreground">
              {fields.map((f) => (
                <span key={f.key} className="rounded-full bg-muted px-2.5 py-1">
                  {f.label}
                  {f.required ? " (required)" : ""}
                </span>
              ))}
            </div>
            <div className="pl-12">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors">
                <Download className="h-3.5 w-3.5" /> Download CSV template
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                <Upload className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h2 className="font-serif text-lg">Upload your file</h2>
                <p className="text-sm text-muted-foreground">Accepts .csv and .xlsx.</p>
              </div>
            </div>
            <div className="pl-12">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="btn-primary inline-flex items-center gap-1.5"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Choose a file
              </button>
            </div>
          </div>

          {history.length > 0 && <ImportHistory history={history} />}
        </section>
      )}

      {step === "map" && parsed && (
        <section className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="font-serif text-lg">Match your columns</h2>
              <p className="text-sm text-muted-foreground">
                We read <span className="font-medium text-foreground">{parsed.rows.length}</span> rows
                from <span className="font-medium text-foreground">{parsed.filename}</span>. Confirm which
                column feeds each field.
              </p>
            </div>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-wrap items-center gap-3">
                  <label className="w-40 text-sm">
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </label>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="min-w-[12rem] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="">Not mapped</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {requiredUnmapped.length > 0 && (
              <p className="text-xs text-amber-700">
                Map a column for: {requiredUnmapped.join(", ")}.
              </p>
            )}
          </div>

          <MappingPreview parsed={parsed} mapping={mapping} fields={fields} />

          <div className="flex items-center gap-2">
            <button type="button" onClick={reset} className="rounded-md border border-border px-4 py-2 text-sm">
              Start over
            </button>
            <button
              type="button"
              onClick={() => void runValidate()}
              disabled={busy || requiredUnmapped.length > 0}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Check rows
            </button>
          </div>
        </section>
      )}

      {step === "review" && validation && parsed && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-3xl font-serif text-primary">{validation.acceptedCount}</p>
              <p className="text-sm text-muted-foreground">ready to enroll</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-3xl font-serif">{validation.rejectedCount}</p>
              <p className="text-sm text-muted-foreground">need attention</p>
            </div>
          </div>

          {validation.rejectedCount > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h2 className="font-serif text-lg">Rows that need attention</h2>
              <ul className="space-y-1.5 text-sm">
                {validation.report
                  .filter((r) => !r.ok)
                  .map((r) => (
                    <li key={r.row} className="flex items-center gap-2 text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span className="font-medium text-foreground">Row {r.row}</span>
                      {r.name ? <span>· {r.name}</span> : null}
                      <span>· {r.reason}</span>
                    </li>
                  ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                These rows will be skipped. Fix them in your file and upload again to include them.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStep("map")} className="rounded-md border border-border px-4 py-2 text-sm">
              Back to mapping
            </button>
            <button
              type="button"
              onClick={() => void runCommit()}
              disabled={busy || validation.acceptedCount === 0}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enroll {validation.acceptedCount} patient{validation.acceptedCount === 1 ? "" : "s"}
            </button>
          </div>
        </section>
      )}

      {step === "done" && committed && (
        <section className="space-y-6">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center space-y-3">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-5 w-5" />
            </div>
            <h2 className="font-serif text-xl">
              {committed.acceptedCount} patient{committed.acceptedCount === 1 ? "" : "s"} enrolled
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              We have emailed each one a consent invite. Their status moves to Consented once they sign.
              {committed.rejectedCount > 0
                ? ` ${committed.rejectedCount} row${committed.rejectedCount === 1 ? " was" : "s were"} skipped.`
                : ""}
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <Link href="/care/patients" className="btn-primary">
                View patients
              </Link>
              <button type="button" onClick={reset} className="rounded-md border border-border px-4 py-2 text-sm">
                Import another file
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MappingPreview({
  parsed,
  mapping,
  fields,
}: {
  parsed: ParseResponse;
  mapping: Record<string, string>;
  fields: FieldDef[];
}) {
  const preview = parsed.rows.slice(0, 5);
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 overflow-x-auto">
      <h3 className="font-serif text-base">Preview (first {preview.length})</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            {fields.map((f) => (
              <th key={f.key} className="px-2 py-1.5 font-medium">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((raw, i) => (
            <tr key={i} className="border-t border-border/60">
              {fields.map((f) => {
                const header = mapping[f.key];
                return (
                  <td key={f.key} className="px-2 py-1.5 text-muted-foreground">
                    {header ? raw[header] || "—" : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportHistory({ history }: { history: BatchImportView[] }) {
  return (
    <section className="space-y-3 border-t border-border/60 pt-6">
      <h2 className="font-serif text-lg">Recent imports</h2>
      <ul className="space-y-2">
        {history.map((h) => (
          <li
            key={h.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
          >
            <span className="inline-flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              {h.filename || "Upload"}
              <span className="text-xs text-muted-foreground">
                · {new Date(h.createdAt).toLocaleDateString()}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {h.acceptedRows} enrolled
              {h.rejectedRows > 0 ? `, ${h.rejectedRows} skipped` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
