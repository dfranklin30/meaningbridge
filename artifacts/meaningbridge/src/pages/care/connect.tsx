import { useEffect, useState, useCallback } from "react";
import { HeartHandshake, ShieldCheck, Loader2, Check } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Connection {
  id: number;
  status: string;
  clinicianName: string | null;
  clinicianEmail: string | null;
  consentSummaries: boolean;
  consentSafety: boolean;
  consentEngagement: boolean;
  acceptedAt: string | null;
}

type Consent = {
  consentEngagement: boolean;
  consentSafety: boolean;
  consentSummaries: boolean;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Request failed (${res.status})`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const CONSENT_COPY: { key: keyof Consent; label: string; help: string }[] = [
  {
    key: "consentEngagement",
    label: "Engagement",
    help: "Whether and how often you're using MeaningBridge — not what you write.",
  },
  {
    key: "consentSafety",
    label: "Safety signals",
    help: "If the companion ever flags a safety concern, your clinician is notified so they can reach out.",
  },
  {
    key: "consentSummaries",
    label: "Session summaries",
    help: "A short, AI-written summary of what you've been working through — drawn from your own words — to help your clinician prepare. Your raw journal entries are never shared.",
  },
];

export default function ConnectClinician() {
  const initialCode = new URLSearchParams(window.location.search).get("code") ?? "";
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [consent, setConsent] = useState<Consent>({
    consentEngagement: true,
    consentSafety: true,
    consentSummaries: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setConnections(await api<Connection[]>("/care/connections"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load connections");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      await api<Connection>("/care/connect", {
        method: "POST",
        body: JSON.stringify({ code: code.trim(), ...consent }),
      });
      setCode("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect");
    } finally {
      setConnecting(false);
    }
  };

  const updateConsent = async (id: number, next: Consent) => {
    setSavingId(id);
    try {
      await api(`/care/connections/${id}/consent`, {
        method: "PATCH",
        body: JSON.stringify(next),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setSavingId(null);
    }
  };

  const disconnect = async (id: number) => {
    try {
      await api(`/care/connections/${id}/revoke`, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect");
    }
  };

  const active = connections.filter((c) => c.status === "active");

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div className="space-y-3">
        <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary">
          <HeartHandshake className="w-5 h-5" />
        </div>
        <h1 className="text-3xl font-serif text-foreground">Connect with your clinician</h1>
        <p className="text-muted-foreground leading-relaxed">
          If a grief professional has invited you, enter their code below and choose what you'd like
          to share. You stay in control — you can change or withdraw any of this at any time, and
          your private writing is never shared unless you explicitly choose summaries.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={connect} className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Invitation code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 7K2QF9XR"
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono tracking-wider focus:ring-1 focus:ring-primary/50 outline-none"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> What you'll share
          </p>
          {CONSENT_COPY.map(({ key, label, help }) => (
            <label key={key} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={consent[key]}
                onChange={(e) => setConsent((c) => ({ ...c, [key]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground leading-relaxed">{help}</span>
              </span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={connecting || !code.trim()}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Connect
        </button>
      </form>

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Your clinicians</h2>
          {active.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{c.clinicianName || c.clinicianEmail || "Your clinician"}</p>
                <button
                  onClick={() => disconnect(c.id)}
                  className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive hover:text-destructive transition-colors"
                >
                  Disconnect
                </button>
              </div>
              <div className="space-y-2">
                {CONSENT_COPY.map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/90">{label}</span>
                    <input
                      type="checkbox"
                      checked={c[key]}
                      disabled={savingId === c.id}
                      onChange={(e) =>
                        updateConsent(c.id, {
                          consentEngagement: c.consentEngagement,
                          consentSafety: c.consentSafety,
                          consentSummaries: c.consentSummaries,
                          [key]: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
