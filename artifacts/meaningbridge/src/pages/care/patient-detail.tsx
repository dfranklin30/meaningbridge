import { useCallback, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  ShieldAlert,
  CalendarPlus,
  CalendarClock,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import {
  api,
  ApiError,
  Spinner,
  ErrorBanner,
  PhiNotice,
  useTwoFactorGate,
} from "./provider-shell";
import type {
  PatientEngagement,
  Appointment,
  ProviderCalendar,
  CalendarChoice,
  ProviderAssistantReply,
} from "@workspace/api-client-react";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Not yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Not yet";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <div className="text-2xl font-serif">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export default function ProviderPatientDetail() {
  const [, params] = useRoute("/care/patients/:id");
  const patientId = params?.id ? Number(params.id) : null;
  const { guard, challengeElement } = useTwoFactorGate();

  const [loading, setLoading] = useState(true);
  const [phiCode, setPhiCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<PatientEngagement | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendar, setCalendar] = useState<ProviderCalendar | null>(null);
  const [calendarChoices, setCalendarChoices] = useState<CalendarChoice[]>([]);

  const load = useCallback(async () => {
    if (patientId === null || Number.isNaN(patientId)) {
      setError("That patient could not be found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setPhiCode(null);
    setError(null);
    try {
      const [eng, appts, cal] = await Promise.all([
        guard(() => api<PatientEngagement>(`/professional/patients/${patientId}/engagement`)),
        guard(() => api<Appointment[]>(`/professional/patients/${patientId}/appointments`)),
        guard(() => api<ProviderCalendar>("/professional/calendar")),
      ]);
      setEngagement(eng);
      setAppointments(appts);
      setCalendar(cal);
      if (cal.connected) {
        try {
          setCalendarChoices(
            await guard(() => api<CalendarChoice[]>("/professional/calendar/list")),
          );
        } catch {
          setCalendarChoices([]);
        }
      } else {
        setCalendarChoices([]);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) setPhiCode(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not load this patient.");
    } finally {
      setLoading(false);
    }
  }, [guard, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner />;
  if (phiCode) return <PhiNotice code={phiCode} onChallenge={() => window.location.reload()} />;

  return (
    <div className="space-y-8">
      {challengeElement}

      <div className="space-y-1">
        <Link
          href="/care/patients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All patients
        </Link>
        <h1 className="font-serif text-3xl pt-2">Patient overview</h1>
        <p className="text-sm text-muted-foreground">
          Engagement metadata and scheduling only. You never see this patient&rsquo;s conversations,
          journal entries, or the content of any reflection.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {engagement && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Companion sessions" value={engagement.sessionCount} />
            <Metric label="Companion messages" value={engagement.companionMessageCount} />
            <Metric label="Journal entries" value={engagement.journalEntryCount} />
            <Metric label="Check-ins" value={engagement.checkinCount} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Last active" value={fmtRelative(engagement.lastActiveAt)} />
            <Metric label="Last check-in" value={fmtRelative(engagement.lastCheckinAt)} />
            <Metric label="Safety events" value={engagement.safetyEventCount} />
            <Metric label="Open safety events" value={engagement.openSafetyEventCount} />
          </div>
          {engagement.openSafetyEventCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                There {engagement.openSafetyEventCount === 1 ? "is" : "are"}{" "}
                {engagement.openSafetyEventCount} open safety signal
                {engagement.openSafetyEventCount === 1 ? "" : "s"}. Consider reaching out.
              </span>
            </div>
          )}
        </section>
      )}

      <AssistantPanel patientId={patientId!} guard={guard} onPhi={setPhiCode} />

      <AppointmentsPanel
        patientId={patientId!}
        appointments={appointments}
        calendar={calendar}
        calendarChoices={calendarChoices}
        guard={guard}
        onChanged={load}
        onPhi={setPhiCode}
        onCalendar={setCalendar}
      />
    </div>
  );
}

function AssistantPanel({
  patientId,
  guard,
  onPhi,
}: {
  patientId: number;
  guard: <T>(fn: () => Promise<T>) => Promise<T>;
  onPhi: (code: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const reply = await guard(() =>
        api<ProviderAssistantReply>(`/professional/patients/${patientId}/assistant`, {
          method: "POST",
          body: JSON.stringify({ question: q }),
        }),
      );
      setAnswer(reply.answer);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) onPhi(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "The assistant could not answer just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-serif text-lg">Care assistant</h2>
          <p className="text-xs text-muted-foreground">
            Ask about engagement and scheduling. It answers only from metadata — never from what your
            patient has written or said.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="e.g. How engaged has this patient been this month?"
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40 resize-none"
        />
        <button
          type="button"
          onClick={ask}
          disabled={busy || !question.trim()}
          className="btn-primary inline-flex items-center gap-1.5 shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask"}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {answer && (
        <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </section>
  );
}

function AppointmentsPanel({
  patientId,
  appointments,
  calendar,
  calendarChoices,
  guard,
  onChanged,
  onPhi,
  onCalendar,
}: {
  patientId: number;
  appointments: Appointment[];
  calendar: ProviderCalendar | null;
  calendarChoices: CalendarChoice[];
  guard: <T>(fn: () => Promise<T>) => Promise<T>;
  onChanged: () => Promise<void>;
  onPhi: (code: string) => void;
  onCalendar: (cal: ProviderCalendar) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", startsAt: "", endsAt: "", location: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [savingCal, setSavingCal] = useState(false);

  const STATUS_TONE: Record<string, string> = {
    proposed: "bg-amber-100 text-amber-800",
    confirmed: "bg-primary/10 text-primary",
    declined: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };

  const propose = async () => {
    if (busy) return;
    if (!form.startsAt || !form.endsAt) {
      setError("Please choose a start and end time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await guard(() =>
        api<Appointment>(`/professional/patients/${patientId}/appointments`, {
          method: "POST",
          body: JSON.stringify({
            title: form.title.trim() || undefined,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: new Date(form.endsAt).toISOString(),
            location: form.location.trim() || undefined,
            notes: form.notes.trim() || undefined,
          }),
        }),
      );
      setForm({ title: "", startsAt: "", endsAt: "", location: "", notes: "" });
      setShowForm(false);
      await onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) onPhi(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not propose this time.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: number) => {
    setCancellingId(id);
    setError(null);
    try {
      await guard(() =>
        api<Appointment>(`/professional/appointments/${id}/cancel`, { method: "POST" }),
      );
      await onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) onPhi(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not cancel this appointment.");
    } finally {
      setCancellingId(null);
    }
  };

  const saveCalendar = async (patch: { syncEnabled?: boolean; calendarId?: string }) => {
    if (!calendar || savingCal) return;
    setSavingCal(true);
    setError(null);
    try {
      const updated = await guard(() =>
        api<ProviderCalendar>("/professional/calendar", {
          method: "PUT",
          body: JSON.stringify(patch),
        }),
      );
      onCalendar(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) onPhi(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not update calendar sync.");
    } finally {
      setSavingCal(false);
    }
  };

  const active = appointments.filter((a) => a.status === "proposed" || a.status === "confirmed");
  const past = appointments.filter((a) => a.status === "declined" || a.status === "cancelled");

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif text-lg">Appointments</h2>
            <p className="text-xs text-muted-foreground">
              Propose a time; your patient confirms by email. No login needed for them.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <CalendarPlus className="w-4 h-4" /> Propose a time
        </button>
      </div>

      {calendar && (
        <div className="rounded-lg border border-border/70 bg-background px-4 py-3 space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-primary focus:ring-primary"
              checked={calendar.syncEnabled}
              disabled={savingCal || !calendar.connected}
              onChange={() => void saveCalendar({ syncEnabled: !calendar.syncEnabled })}
            />
            <span className="flex-1">
              <span className="font-medium block">
                Add confirmed appointments to Google Calendar
              </span>
              <span className="text-xs text-muted-foreground">
                {calendar.connected
                  ? "Confirmed times are written to your chosen calendar."
                  : "Connect a Google Calendar account to enable this."}
              </span>
            </span>
          </label>

          {calendar.connected && calendar.syncEnabled && calendarChoices.length > 0 && (
            <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
              <span className="text-muted-foreground sm:w-40 shrink-0">Sync to calendar</span>
              <select
                className="flex-1 rounded-md border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={
                  calendarChoices.some((c) => c.id === calendar.calendarId)
                    ? calendar.calendarId
                    : "primary"
                }
                disabled={savingCal}
                onChange={(e) => void saveCalendar({ calendarId: e.target.value })}
              >
                {!calendarChoices.some((c) => c.id === "primary") && (
                  <option value="primary">Primary calendar</option>
                )}
                {calendarChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                    {c.primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <div className="rounded-lg border border-border/70 bg-background p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Session with your therapist"
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Starts</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ends</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Location (optional)</label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Telehealth, or an address"
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={propose}
              disabled={busy}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send proposal"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-md border border-border text-sm hover:border-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {active.length === 0 && past.length === 0 ? (
        <p className="text-sm text-muted-foreground">No appointments yet.</p>
      ) : (
        <ul className="space-y-2">
          {[...active, ...past].map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-4 py-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.title}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                      STATUS_TONE[a.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDateTime(a.startsAt)}
                  {a.location ? ` · ${a.location}` : ""}
                </div>
              </div>
              {(a.status === "proposed" || a.status === "confirmed") && (
                <button
                  type="button"
                  onClick={() => cancel(a.id)}
                  disabled={cancellingId === a.id}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  {cancellingId === a.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
