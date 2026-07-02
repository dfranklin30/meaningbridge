import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Download } from "lucide-react";
import { api, ApiError, Spinner, ErrorBanner } from "../care/provider-shell";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuditRow {
  id: number;
  action: string;
  actorUserId: number | null;
  actorEmail: string | null;
  subjectUserId: number | null;
  subjectEmail: string | null;
  relationshipId: number | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

interface AuditResponse {
  rows: AuditRow[];
  total: number;
  limit: number;
  offset: number;
}

interface Metrics {
  users: number;
  seekers: number;
  professionals: number;
  patients: number;
  activePatients: number;
  auditEntries: number;
}

interface Filters {
  action: string;
  actorUserId: string;
  subjectUserId: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { action: "", actorUserId: "", subjectUserId: "", from: "", to: "" };
const PAGE = 100;

function toQuery(f: Filters, limit: number, offset: number): string {
  const p = new URLSearchParams();
  if (f.action.trim()) p.set("action", f.action.trim());
  if (f.actorUserId.trim()) p.set("actorUserId", f.actorUserId.trim());
  if (f.subjectUserId.trim()) p.set("subjectUserId", f.subjectUserId.trim());
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", new Date(`${f.to}T23:59:59`).toISOString());
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return p.toString();
}

export default function AdminAudit() {
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, m] = await Promise.all([
        api<AuditResponse>(`/professional/admin/audit?${toQuery(applied, PAGE, offset)}`),
        api<Metrics>(`/professional/admin/metrics`),
      ]);
      setData(rows);
      setMetrics(m);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Could not load the audit trail");
    } finally {
      setLoading(false);
    }
  }, [applied, offset]);

  useEffect(() => {
    load();
  }, [load]);

  if (forbidden) {
    return (
      <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <ShieldCheck className="w-6 h-6 text-muted-foreground mx-auto" />
        <h1 className="font-serif text-xl">Administrators only</h1>
        <p className="text-sm text-muted-foreground">
          This oversight area is limited to platform administrators.
        </p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, total);
  const exportUrl = `${basePath}/api/professional/admin/audit/export?${toQuery(applied, PAGE, 0)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl">Audit trail</h1>
          <p className="text-muted-foreground">
            The append-only record of every sensitive access and change across the platform.
          </p>
        </div>
        <a
          href={exportUrl}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-border text-sm hover:border-foreground transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="People" value={metrics.users} />
          <Metric label="Seekers" value={metrics.seekers} />
          <Metric label="Clinicians" value={metrics.professionals} />
          <Metric label="Patients" value={metrics.patients} />
          <Metric label="Active" value={metrics.activePatients} />
          <Metric label="Audit entries" value={metrics.auditEntries} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setApplied(draft);
        }}
        className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end rounded-xl border border-border bg-card p-4"
      >
        <Field label="Action">
          <input
            className="input"
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            placeholder="e.g. consent"
          />
        </Field>
        <Field label="Actor id">
          <input
            className="input"
            value={draft.actorUserId}
            onChange={(e) => setDraft((d) => ({ ...d, actorUserId: e.target.value }))}
            inputMode="numeric"
          />
        </Field>
        <Field label="Subject id">
          <input
            className="input"
            value={draft.subjectUserId}
            onChange={(e) => setDraft((d) => ({ ...d, subjectUserId: e.target.value }))}
            inputMode="numeric"
          />
        </Field>
        <Field label="From">
          <input
            type="date"
            className="input"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            className="input"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </Field>
        <div className="flex items-center gap-2 lg:col-span-5">
          <button type="submit" className="btn-primary py-1.5">
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setApplied(EMPTY);
              setOffset(0);
            }}
            className="px-4 py-1.5 rounded-md border border-border text-sm hover:border-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      </form>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No matching entries.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/60">
                  <th className="px-4 py-2.5 font-normal">When</th>
                  <th className="px-4 py-2.5 font-normal">Action</th>
                  <th className="px-4 py-2.5 font-normal">Actor</th>
                  <th className="px-4 py-2.5 font-normal">Subject</th>
                  <th className="px-4 py-2.5 font-normal">Detail</th>
                  <th className="px-4 py-2.5 font-normal">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0 align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.action}</td>
                    <td className="px-4 py-2.5">{formatParty(r.actorEmail, r.actorUserId)}</td>
                    <td className="px-4 py-2.5">{formatParty(r.subjectEmail, r.subjectUserId)}</td>
                    <td className="px-4 py-2.5 text-foreground/80">{r.detail || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {showingFrom}–{showingTo} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
                className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:border-foreground transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={showingTo >= total}
                onClick={() => setOffset((o) => o + PAGE)}
                className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:border-foreground transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatParty(email: string | null, id: number | null) {
  if (email) return email;
  if (id != null) return <span className="text-muted-foreground">#{id}</span>;
  return <span className="text-muted-foreground">system</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-serif text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
