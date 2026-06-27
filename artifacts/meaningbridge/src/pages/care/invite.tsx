import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  ArrowLeft,
  Copy,
  Check,
  UserPlus,
  ShieldCheck,
  Users,
  Loader2,
} from "lucide-react";
import { Logo } from "@/components/logo";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const ORIGIN = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

interface Invite {
  id: number;
  inviteCode: string;
  inviteEmail: string | null;
  inviteNote: string | null;
  status: string;
  createdAt: string;
}
interface RosterEntry {
  id: number;
  clientFirstName: string | null;
  clientEmail: string | null;
  consentSummaries: boolean;
  consentSafety: boolean;
  consentEngagement: boolean;
  acceptedAt: string | null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Request failed (${res.status})`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export default function CareInvite() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [inv, ros] = await Promise.all([
        api<Invite[]>("/care/invites"),
        api<RosterEntry[]>("/care/roster"),
      ]);
      setInvites(inv);
      setRoster(ros);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }, []);

  useEffect(() => {
    if (me?.role === "professional") refresh();
  }, [me?.role, refresh]);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api<Invite>("/care/invites", {
        method: "POST",
        body: JSON.stringify({ email: email || undefined, note: note || undefined }),
      });
      setEmail("");
      setNote("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invite");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: number) => {
    try {
      await api(`/care/connections/${id}/revoke`, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (meLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (me?.role !== "professional") {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-4">
        <h1 className="text-2xl font-serif">For professionals</h1>
        <p className="text-muted-foreground">
          This area is for clinicians. If you work with grieving clients and would like access,
          you can join the professional waitlist.
        </p>
        <Link href="/notify?src=care-invite" className="text-primary underline underline-offset-4">
          Join the professional waitlist
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/caregiver">
            <div className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              <Logo variant="lockup" size={36} />
            </div>
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            People in your care
          </span>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-12 space-y-12">
        <section className="space-y-3 max-w-2xl">
          <h1 className="text-3xl font-serif">Invite a client</h1>
          <p className="text-muted-foreground leading-relaxed">
            Send an invitation to someone in your care. They choose what to share with you —
            engagement, safety signals, or session summaries — and can change or withdraw that
            consent at any time. Nothing reaches you without it.
          </p>
        </section>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid lg:grid-cols-5 gap-8">
          <form onSubmit={createInvite} className="lg:col-span-2 space-y-4 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="w-4 h-4 text-primary" /> New invitation
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Client email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary/50 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">A short note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="A personal line they'll see when connecting."
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm resize-none focus:ring-1 focus:ring-primary/50 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Create invitation
            </button>
          </form>

          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Pending invitations</h2>
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No pending invitations.</p>
            ) : (
              <div className="space-y-3">
                {invites.map((inv) => {
                  const link = `${ORIGIN}/care/connect?code=${inv.inviteCode}`;
                  return (
                    <div key={inv.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{inv.inviteEmail || "Anyone with the code"}</p>
                          <p className="text-xs text-muted-foreground">Code <span className="font-mono">{inv.inviteCode}</span></p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">
                          {inv.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copy(inv.inviteCode, `code-${inv.id}`)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-foreground transition-colors"
                        >
                          {copied === `code-${inv.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy code
                        </button>
                        <button
                          onClick={() => copy(link, `link-${inv.id}`)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-foreground transition-colors"
                        >
                          {copied === `link-${inv.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy connect link
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" /> Connected clients
          </h2>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No one has connected yet. Share an invite code or link above.
            </p>
          ) : (
            <div className="grid gap-3">
              {roster.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.clientFirstName || c.clientEmail || "Client"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary/70" />
                      Sharing: {[
                        c.consentEngagement && "engagement",
                        c.consentSafety && "safety",
                        c.consentSummaries && "summaries",
                      ].filter(Boolean).join(", ") || "nothing yet"}
                    </p>
                  </div>
                  <button
                    onClick={() => revoke(c.id)}
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-destructive hover:text-destructive transition-colors shrink-0"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
