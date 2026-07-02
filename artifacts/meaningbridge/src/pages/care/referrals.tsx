import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, ArrowDownLeft, ArrowUpRight, MessageSquare } from "lucide-react";
import {
  api,
  ApiError,
  Spinner,
  ErrorBanner,
  PhiNotice,
  useTwoFactorGate,
  type ReferralView,
  type ReferralMessage,
  type Me,
} from "./provider-shell";

const STATUS_TONE: Record<ReferralView["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-primary/10 text-primary",
  declined: "bg-muted text-muted-foreground",
};

export default function ProviderReferrals({ me }: { me: Me }) {
  const { guard, challengeElement } = useTwoFactorGate();
  const [referrals, setReferrals] = useState<ReferralView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateCode, setGateCode] = useState<string | null>(null);

  const initialTo = new URLSearchParams(window.location.search).get("to") ?? "";
  const [patientId, setPatientId] = useState("");
  const [toProviderUserId, setToProviderUserId] = useState(initialTo);
  const [summary, setSummary] = useState("");
  const [sending, setSending] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGateCode(null);
    try {
      setReferrals(await guard(() => api<ReferralView[]>("/professional/referrals")));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setGateCode(e.code);
      else setError(e instanceof Error ? e.message : "Could not load referrals");
    } finally {
      setLoading(false);
    }
  }, [guard]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(patientId);
    const to = Number(toProviderUserId);
    if (!pid || !to) return;
    setSending(true);
    setError(null);
    try {
      await guard(() =>
        api("/professional/referrals", {
          method: "POST",
          body: JSON.stringify({ patientId: pid, toProviderUserId: to, summary: summary.trim() || undefined }),
        }),
      );
      setPatientId("");
      setToProviderUserId("");
      setSummary("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send referral");
    } finally {
      setSending(false);
    }
  };

  const respond = async (id: number, action: "accept" | "decline") => {
    setError(null);
    try {
      await guard(() =>
        api(`/professional/referrals/${id}/respond`, {
          method: "POST",
          body: JSON.stringify({ action }),
        }),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not respond");
    }
  };

  return (
    <>
      {challengeElement}
      {loading ? (
        <Spinner />
      ) : gateCode ? (
        <PhiNotice code={gateCode} onChallenge={() => load()} />
      ) : (
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="font-serif text-3xl">Referrals</h1>
            <p className="text-muted-foreground">
              Send a client to a trusted colleague, or respond to referrals sent to you.
            </p>
          </div>

          {error && <ErrorBanner message={error} />}

          <form onSubmit={send} className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-serif text-lg">Send a referral</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Client ID</label>
                <input
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 14"
                  inputMode="numeric"
                  className="input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Colleague ID</label>
                <input
                  value={toProviderUserId}
                  onChange={(e) => setToProviderUserId(e.target.value.replace(/\D/g, ""))}
                  placeholder="from the directory"
                  inputMode="numeric"
                  className="input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Note for your colleague</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="A short, respectful summary of why you are referring."
                className="input min-h-[80px] resize-y"
              />
            </div>
            <button type="submit" disabled={sending || !patientId || !toProviderUserId} className="btn-primary">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send referral
            </button>
          </form>

          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No referrals yet.</p>
          ) : (
            <div className="space-y-3">
              {referrals.map((r) => {
                const incoming = r.toProviderUserId === me.id;
                return (
                  <div key={r.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {incoming ? (
                          <ArrowDownLeft className="w-4 h-4 text-primary" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {incoming
                              ? `From ${r.fromProviderName ?? "a colleague"}`
                              : `To ${r.toProviderName ?? "a colleague"}`}
                            {r.patientLabel && (
                              <span className="text-muted-foreground"> · client {r.patientLabel}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_TONE[r.status]}`}>{r.status}</span>
                    </div>
                    {r.summary && <p className="text-sm text-foreground/80 leading-relaxed">{r.summary}</p>}
                    <div className="flex items-center gap-3">
                      {incoming && r.status === "pending" && (
                        <>
                          <button type="button" onClick={() => respond(r.id, "accept")} className="btn-primary py-1.5">
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => respond(r.id, "decline")}
                            className="px-4 py-1.5 rounded-md border border-border text-sm hover:border-foreground transition-colors"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === r.id ? null : r.id)}
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1 ml-auto"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {openId === r.id ? "Hide messages" : "Messages"}
                      </button>
                    </div>
                    {openId === r.id && <ReferralThread referralId={r.id} me={me} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ReferralThread({ referralId, me }: { referralId: number; me: Me }) {
  const { guard, challengeElement } = useTwoFactorGate();
  const [messages, setMessages] = useState<ReferralMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await guard(() => api<ReferralMessage[]>(`/professional/referrals/${referralId}/messages`)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load messages");
    } finally {
      setLoading(false);
    }
  }, [guard, referralId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await guard(() =>
        api(`/professional/referrals/${referralId}/messages`, {
          method: "POST",
          body: JSON.stringify({ body: body.trim() }),
        }),
      );
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border/60 pt-4 space-y-3">
      {challengeElement}
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : messages.length === 0 ? (
        <p className="text-xs text-muted-foreground">No messages yet.</p>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => {
            const mine = m.senderUserId === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <form onSubmit={send} className="flex items-center gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" className="input" />
        <button type="submit" disabled={sending || !body.trim()} className="btn-primary px-3">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
