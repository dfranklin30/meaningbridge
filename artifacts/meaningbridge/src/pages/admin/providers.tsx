import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import {
  api,
  ApiError,
  Spinner,
  ErrorBanner,
  type AdminProviderItem,
} from "../care/provider-shell";

type StatusFilter = "pending" | "verified" | "rejected" | "all";
const FILTERS: StatusFilter[] = ["pending", "verified", "rejected", "all"];

export default function AdminProviders() {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [items, setItems] = useState<AdminProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api<AdminProviderItem[]>(`/professional/admin/providers?status=${filter}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setError(e instanceof Error ? e.message : "Could not load providers");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: number, action: "approve" | "reject") => {
    setBusyId(id);
    setError(null);
    try {
      await api(`/professional/admin/providers/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ action, note: notes[id]?.trim() || undefined }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save decision");
    } finally {
      setBusyId(null);
    }
  };

  if (forbidden) {
    return (
      <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <ShieldCheck className="w-6 h-6 text-muted-foreground mx-auto" />
        <h1 className="font-serif text-xl">Administrators only</h1>
        <p className="text-sm text-muted-foreground">This oversight area is limited to platform administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl">Verification queue</h1>
        <p className="text-muted-foreground">Review clinician profiles before they can access client information.</p>
      </div>

      <div className="flex items-center gap-1 text-sm">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md capitalize transition-colors ${
              filter === f ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nothing here.</p>
      ) : (
        <div className="space-y-4">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg">
                    {p.fullName || "Unnamed"} {p.credential && <span className="text-muted-foreground">· {p.credential}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{p.userEmail}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                  {p.verificationStatus}
                </span>
              </div>

              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <Row label="NPI" value={p.npi} />
                <Row label="License" value={[p.licenseNumber, p.licenseState].filter(Boolean).join(" · ")} />
                <Row label="Practice" value={p.practiceName} />
                <Row label="States" value={p.statesLicensed.join(", ")} />
                <Row label="Specialties" value={p.specialtyTags.join(", ")} />
                <Row label="Telehealth" value={p.telehealth ? "Yes" : "No"} />
              </dl>

              {p.bio && <p className="text-sm text-foreground/80 leading-relaxed">{p.bio}</p>}

              <div className="space-y-2 border-t border-border/60 pt-4">
                <input
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                  placeholder="Optional note (shown to the provider if rejected)"
                  className="input"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decide(p.id, "approve")}
                    disabled={busyId === p.id}
                    className="btn-primary py-1.5"
                  >
                    {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(p.id, "reject")}
                    disabled={busyId === p.id}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-border text-sm hover:border-destructive hover:text-destructive transition-colors disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="text-foreground/90">{value || "—"}</dd>
    </div>
  );
}
