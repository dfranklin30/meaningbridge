import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Check, LifeBuoy } from "lucide-react";
import { Logo } from "@/components/logo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ConsentInfo {
  firstName: string | null;
  providerName: string | null;
  practiceName: string | null;
  documentVersion: string;
  status: string;
  alreadySigned: boolean;
  closed: boolean;
}

type View =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "closed"; message: string }
  | { kind: "signed"; info: ConsentInfo }
  | { kind: "form"; info: ConsentInfo }
  | { kind: "success"; info: ConsentInfo };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background font-sans text-foreground flex flex-col">
      <header className="border-b border-border/60">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo variant="lockup" size={32} />
          <a
            href={`${basePath}/crisis`}
            className="inline-flex items-center gap-1.5 text-xs text-destructive opacity-80 hover:opacity-100 transition-opacity"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Crisis support
          </a>
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-1 w-full max-w-2xl mx-auto px-6 py-12"
      >
        {children}
      </motion.main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        MeaningBridge is an adjunct to care and does not replace therapy or emergency services.
      </footer>
    </div>
  );
}

export default function ConsentPage() {
  const [, params] = useRoute("/consent/:token");
  const token = params?.token ?? "";
  const [view, setView] = useState<View>({ kind: "loading" });
  const [signerName, setSignerName] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawToken, setWithdrawToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${basePath}/api/consent/${encodeURIComponent(token)}`, {
          headers: { "Content-Type": "application/json" },
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setView({ kind: "invalid", message: body?.error ?? "This link is not valid." });
          return;
        }
        const info = body as ConsentInfo;
        if (info.closed) {
          setView({ kind: "closed", message: "This invitation is no longer active." });
        } else if (info.alreadySigned) {
          setView({ kind: "signed", info });
        } else {
          setView({ kind: "form", info });
        }
      } catch {
        if (!cancelled) setView({ kind: "invalid", message: "We could not open this link. Please try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (view.kind !== "form") return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/consent/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim(), agree: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "We could not record your signature.");
        return;
      }
      if (typeof body?.withdrawToken === "string") setWithdrawToken(body.withdrawToken);
      setView({ kind: "success", info: view.info });
    } catch {
      setError("We could not record your signature. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (view.kind === "loading") {
    return (
      <Shell>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (view.kind === "invalid" || view.kind === "closed") {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3 max-w-lg mx-auto">
          <h1 className="font-serif text-2xl">This link cannot be opened</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{view.message}</p>
        </div>
      </Shell>
    );
  }

  if (view.kind === "signed" || view.kind === "success") {
    const first = view.info.firstName;
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mx-auto">
            <Check className="w-5 h-5" />
          </div>
          <h1 className="font-serif text-2xl">
            {view.kind === "success" ? "Thank you" : "Your consent is on file"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {first ? `${first}, your` : "Your"} consent has been recorded.
            {view.info.providerName ? ` ${view.info.providerName} will` : " Your clinician will"} help
            you get started with MeaningBridge. You can close this page.
          </p>
          {view.kind === "success" && withdrawToken && (
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
              You may withdraw your consent at any time. Keep this private link to do so later:
              <br />
              <a
                href={`${basePath}/consent/withdraw/${withdrawToken}`}
                className="text-foreground underline break-all"
              >
                {`${window.location.origin}${basePath}/consent/withdraw/${withdrawToken}`}
              </a>
            </p>
          )}
        </div>
      </Shell>
    );
  }

  const info = view.info;
  return (
    <Shell>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl">
            {info.firstName ? `Hello ${info.firstName},` : "Welcome"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {info.providerName ?? "Your clinician"}
            {info.practiceName ? ` at ${info.practiceName}` : ""} has invited you to MeaningBridge, a
            gentle companion for living with loss. Please review and sign below.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card p-6 space-y-4 text-sm leading-relaxed">
          <h2 className="font-serif text-lg">Your consent</h2>
          <p>
            MeaningBridge offers a private space to reflect, journal, and talk with a supportive
            companion as you grieve. Your clinician can see whether you are using it and how often —
            never what you write or say.
          </p>
          <p>
            <strong>MeaningBridge does not replace therapy or emergency care.</strong> It cannot
            respond to emergencies. If you are ever in crisis, call or text 988 (in the US) or your
            local emergency number.
          </p>
          <p>
            Your information is stored securely and used only to provide this service and to support
            your care. You may withdraw your consent at any time by telling your clinician.
          </p>
          <p className="text-xs text-muted-foreground">Consent document version {info.documentVersion}.</p>
        </section>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm text-foreground mb-1.5">Type your full name to sign</label>
            <input
              className="input"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1"
            />
            <span>
              I have read and understood the above, and I agree to use MeaningBridge on these terms.
            </span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !signerName.trim() || !agree}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign and continue"}
          </button>
        </form>

        <p className="text-center">
          <Link href="/crisis" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Need support right now?
          </Link>
        </p>
      </div>
    </Shell>
  );
}
