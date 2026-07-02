import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, Copy, Check } from "lucide-react";
import { QRCodeImage } from "@/components/qr-code";
import { api, Spinner, ErrorBanner, type SecurityStatus } from "./provider-shell";

type Phase = "idle" | "enrolling" | "recovery";

export default function ProviderSecurity() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  const load = async () => {
    try {
      setStatus(await api<SecurityStatus>("/professional/security"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load security status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const beginSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await api<{ secret: string; otpauthUri: string }>("/professional/security/totp/setup", {
        method: "POST",
      });
      setSetup(s);
      setPhase("enrolling");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not begin setup");
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ recoveryCodes: string[] }>("/professional/security/totp/enable", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      setRecoveryCodes(r.recoveryCodes);
      setPhase("recovery");
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not match");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisabling(true);
    setError(null);
    try {
      await api("/professional/security/totp/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      setDisableCode("");
      setPhase("idle");
      setSetup(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not match");
    } finally {
      setDisabling(false);
    }
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="space-y-3">
        <h1 className="font-serif text-3xl">Two-step verification</h1>
        <p className="text-muted-foreground leading-relaxed">
          Client records contain protected health information. A second factor from your authenticator
          app is required before you can open them, and your session locks after a period of inactivity.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {phase === "recovery" ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg">Save your recovery codes</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Keep these somewhere safe. Each one can be used once if you lose access to your authenticator
            app. They will not be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-4 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={copyCodes} className="btn-primary">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy codes"}
            </button>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="px-4 py-2 rounded-md border border-border text-sm"
            >
              Done
            </button>
          </div>
        </div>
      ) : status?.totpEnabled ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-serif text-lg">Active</h2>
              <p className="text-sm text-muted-foreground">
                {status.recoveryCodesRemaining} recovery code
                {status.recoveryCodesRemaining === 1 ? "" : "s"} remaining. Sessions lock after{" "}
                {status.idleTimeoutMinutes} minutes of inactivity.
              </p>
            </div>
          </div>
          <form onSubmit={disable} className="space-y-3 border-t border-border/60 pt-5">
            <p className="text-sm text-muted-foreground">
              To turn off two-step verification, confirm a current code.
            </p>
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              className="input font-mono tracking-wider max-w-[200px]"
            />
            <button
              type="submit"
              disabled={disabling || !disableCode.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:border-destructive hover:text-destructive transition-colors disabled:opacity-60"
            >
              {disabling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              Turn off
            </button>
          </form>
        </div>
      ) : phase === "enrolling" && setup ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-serif text-lg">Scan this code</h2>
          <p className="text-sm text-muted-foreground">
            Open your authenticator app (such as Google Authenticator, Authy, or 1Password) and scan the
            code below, or enter the key manually.
          </p>
          <div className="flex justify-center">
            <QRCodeImage value={setup.otpauthUri} size={200} className="rounded-lg" />
          </div>
          <p className="text-center text-xs text-muted-foreground break-all">
            Manual key: <span className="font-mono">{setup.secret}</span>
          </p>
          <form onSubmit={enable} className="space-y-3 border-t border-border/60 pt-5">
            <label className="text-xs text-muted-foreground">Enter the 6-digit code to confirm</label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              className="input font-mono tracking-wider max-w-[200px]"
            />
            <button type="submit" disabled={busy || !code.trim()} className="btn-primary">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm and enable
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h2 className="font-serif text-lg">Not yet set up</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            You will need an authenticator app on your phone. Setup takes about a minute.
          </p>
          <button type="button" onClick={beginSetup} disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Begin setup
          </button>
        </div>
      )}
    </div>
  );
}
