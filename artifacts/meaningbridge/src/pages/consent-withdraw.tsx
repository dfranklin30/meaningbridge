import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Check, LifeBuoy } from "lucide-react";
import { Logo } from "@/components/logo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WithdrawInfo {
  firstName: string | null;
  providerName: string | null;
  practiceName: string | null;
  status: string;
}

type View =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "confirm"; info: WithdrawInfo }
  | { kind: "done"; info: WithdrawInfo };

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

export default function ConsentWithdrawPage() {
  const [, params] = useRoute("/consent/withdraw/:token");
  const token = params?.token ?? "";
  const [view, setView] = useState<View>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${basePath}/api/consent/withdraw/${encodeURIComponent(token)}`, {
          headers: { "Content-Type": "application/json" },
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setView({ kind: "invalid", message: body?.error ?? "This link is not valid." });
          return;
        }
        const info = body as WithdrawInfo;
        if (info.status === "revoked") setView({ kind: "done", info });
        else setView({ kind: "confirm", info });
      } catch {
        if (!cancelled)
          setView({ kind: "invalid", message: "We could not open this link. Please try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function withdraw() {
    if (view.kind !== "confirm") return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/consent/withdraw/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "We could not withdraw your consent.");
        return;
      }
      setView({ kind: "done", info: view.info });
    } catch {
      setError("We could not withdraw your consent. Please try again.");
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

  if (view.kind === "invalid") {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3 max-w-lg mx-auto">
          <h1 className="font-serif text-2xl">This link cannot be opened</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{view.message}</p>
        </div>
      </Shell>
    );
  }

  if (view.kind === "done") {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mx-auto">
            <Check className="w-5 h-5" />
          </div>
          <h1 className="font-serif text-2xl">Your consent has been withdrawn</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your information is no longer shared, and your personal details have been removed. You can
            close this page. If you ever wish to return, your clinician can send a new invitation.
          </p>
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
            {info.firstName ? `${info.firstName}, withdraw your consent?` : "Withdraw your consent?"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Withdrawing means {info.providerName ?? "your clinician"}
            {info.practiceName ? ` at ${info.practiceName}` : ""} will no longer see whether or how you
            use MeaningBridge, and the personal details on file will be removed. This cannot be undone.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={withdraw}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:border-destructive hover:text-destructive transition-colors disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Withdraw my consent"}
          </button>
        </div>

        <p className="text-center">
          <Link
            href="/crisis"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Need support right now?
          </Link>
        </p>
      </div>
    </Shell>
  );
}
