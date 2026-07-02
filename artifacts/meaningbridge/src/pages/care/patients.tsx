import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  Plus,
  CalendarClock,
  MessageSquare,
  FileText,
  Check,
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
import { DemoPatientCard } from "./demo-sample";

interface PatientSummary {
  id: number;
  firstName: string | null;
  lastName: string | null;
  pronouns: string | null;
  status: string;
  isDemoSample: boolean;
  sessionCount: number;
  lastActiveAt: string | null;
  createdAt: string;
}

interface IntakeSummary {
  id: number;
  status: string;
  patientId: number | null;
  patientLabel: string | null;
  riskFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  invited: "Invited",
  consented: "Consented",
  active: "Active",
  revoked: "Consent withdrawn",
  inactive: "Inactive",
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-primary/10 text-primary"
      : status === "consented"
        ? "bg-emerald-100 text-emerald-800"
        : status === "invited"
          ? "bg-amber-100 text-amber-800"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Not yet active";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Not yet active";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 30) return `Active ${days} days ago`;
  return `Active on ${new Date(iso).toLocaleDateString()}`;
}

export default function ProviderPatients() {
  const search = useSearch();
  const justEnrolled = new URLSearchParams(search).get("enrolled") === "1";
  const { guard, challengeElement } = useTwoFactorGate();

  const [loading, setLoading] = useState(true);
  const [phiCode, setPhiCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [drafts, setDrafts] = useState<IntakeSummary[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPhiCode(null);
    setError(null);
    try {
      const [pts, intakes] = await Promise.all([
        guard(() => api<PatientSummary[]>("/professional/patients")),
        guard(() => api<IntakeSummary[]>("/professional/intakes")),
      ]);
      setPatients(pts);
      setDrafts(intakes.filter((i) => i.status === "draft"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) setPhiCode(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not load your patients.");
    } finally {
      setLoading(false);
    }
  }, [guard]);

  useEffect(() => {
    void load();
  }, [load]);

  async function activate(id: number) {
    setActivatingId(id);
    setError(null);
    try {
      const updated = await guard(() =>
        api<PatientSummary>(`/professional/patients/${id}/activate`, { method: "POST" }),
      );
      setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) setPhiCode(err.code);
      else setError(err instanceof Error ? err.message : "We could not activate this patient.");
    } finally {
      setActivatingId(null);
    }
  }

  if (loading) return <Spinner />;
  if (phiCode) return <PhiNotice code={phiCode} onChallenge={() => window.location.reload()} />;

  const realPatients = patients.filter((p) => !p.isDemoSample);

  return (
    <div className="space-y-8">
      {challengeElement}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl">Patients</h1>
          <p className="text-sm text-muted-foreground">
            You see enrollment status and engagement metadata only — never a patient&rsquo;s
            conversations with the companion.
          </p>
        </div>
        <Link href="/care/intake" className="btn-primary inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Enroll a patient
        </Link>
      </div>

      {justEnrolled && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          Intake submitted. We have emailed the patient a consent invite; their status will move to
          Consented once they sign.
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg">Drafts in progress</h2>
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {d.patientLabel || "Untitled intake"}
                  <span className="text-xs text-muted-foreground">
                    · saved {new Date(d.updatedAt).toLocaleDateString()}
                  </span>
                </span>
                <Link href={`/care/intake/${d.id}`} className="text-primary hover:underline">
                  Resume
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        {realPatients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center space-y-3">
            <p className="font-serif text-lg">No patients yet</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Enroll your first patient to send a consent invite and begin. You can also preview a
              sample dashboard below.
            </p>
            <div className="pt-2">
              <Link href="/care/intake" className="btn-primary inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Enroll a patient
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {realPatients.map((p) => {
              const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Patient";
              return (
                <li key={p.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif text-lg">{name}</h3>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.pronouns && <p className="text-xs text-muted-foreground">{p.pronouns}</p>}
                    </div>
                    {p.status === "consented" && (
                      <button
                        type="button"
                        onClick={() => activate(p.id)}
                        disabled={activatingId === p.id}
                        className="btn-primary inline-flex items-center gap-1.5"
                      >
                        {activatingId === p.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" /> Activate
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {p.sessionCount} session{p.sessionCount === 1 ? "" : "s"} started
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      {p.status === "invited"
                        ? "Awaiting consent"
                        : relativeTime(p.lastActiveAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg">Demo mode</h2>
            <p className="text-sm text-muted-foreground">
              A single fictional example to show what an enrolled patient looks like. Off by default.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDemoMode((v) => !v)}
            className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
          >
            {demoMode ? "Hide sample" : "Show sample"}
          </button>
        </div>
        {demoMode && <DemoPatientCard />}
      </section>
    </div>
  );
}
