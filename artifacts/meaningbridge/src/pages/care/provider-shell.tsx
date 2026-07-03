import { useCallback, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useClerk } from "@clerk/react";
import { Loader2, LogOut, ShieldAlert, LifeBuoy } from "lucide-react";
import { Logo } from "@/components/logo";
import { PortalSwitcher } from "@/components/portal-switcher";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = basePath + "/api";

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.code ?? null);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface Me {
  id: number;
  email: string | null;
  firstName: string | null;
  role: "seeker" | "professional" | null;
  isSeeker: boolean;
  isProfessional: boolean;
  activeSpace: "seeker" | "professional" | null;
  isAdmin?: boolean;
}

export interface ProviderProfile {
  id: number;
  userId: number;
  fullName: string | null;
  credential: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  npi: string | null;
  practiceName: string | null;
  practiceAddress: string | null;
  verificationStatus: "pending" | "verified" | "rejected";
  verificationNote?: string | null;
  verifiedAt: string | null;
  directoryOptIn: boolean;
  specialtyTags: string[];
  statesLicensed: string[];
  telehealth: boolean;
  acceptingReferrals: boolean;
  bio: string | null;
}

export interface SecurityStatus {
  totpEnabled: boolean;
  twoFactorActive: boolean;
  recoveryCodesRemaining: number;
  idleTimeoutMinutes: number;
}

export interface DirectoryEntry {
  userId: number;
  fullName: string | null;
  credential: string | null;
  practiceName: string | null;
  specialtyTags: string[];
  statesLicensed: string[];
  telehealth: boolean;
  acceptingReferrals: boolean;
  bio: string | null;
}

export interface ReferralView {
  id: number;
  patientId: number;
  fromProviderUserId: number;
  toProviderUserId: number;
  status: "pending" | "accepted" | "declined";
  summary: string | null;
  respondedAt: string | null;
  createdAt: string;
  fromProviderName?: string | null;
  toProviderName?: string | null;
  patientLabel?: string | null;
}

export interface ReferralMessage {
  id: number;
  referralId: number;
  senderUserId: number;
  body: string;
  createdAt: string;
}

export interface AdminProviderItem extends ProviderProfile {
  userEmail: string | null;
  userFirstName: string | null;
}

const NAV: { href: string; label: string; admin?: boolean }[] = [
  { href: "/care/account", label: "Account" },
  { href: "/care/patients", label: "Patients" },
  { href: "/care/forms", label: "Intake forms" },
  { href: "/care/integrations", label: "Integrations" },
  { href: "/care/directory", label: "Directory" },
  { href: "/care/referrals", label: "Referrals" },
  { href: "/care/security", label: "Security" },
  { href: "/admin/providers", label: "Verification queue", admin: true },
  { href: "/admin/audit", label: "Audit trail", admin: true },
];

/**
 * Chrome for the signed-in clinician portal. Mirrors the seeker layout's calm
 * tone and keeps a persistent crisis affordance on every screen (user pref).
 */
export function ProviderShell({ me, children }: { me: Me; children: ReactNode }) {
  const { signOut } = useClerk();
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-background font-sans text-foreground flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/care/account"
            className="flex items-center opacity-90 hover:opacity-100 transition-opacity"
            aria-label="Return to home"
            title="Return to home"
          >
            <Logo variant="lockup" size={32} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {NAV.filter((n) => !n.admin || me.isAdmin).map((n) => {
              const active = location === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    active ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <PortalSwitcher current="professional" />
            </div>
            <Link
              href="/care/crisis"
              className="flex items-center gap-1.5 text-xs text-destructive opacity-80 hover:opacity-100 transition-opacity"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Crisis support
            </Link>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:border-foreground transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
        <nav className="md:hidden border-t border-border/60 px-4 py-2 flex items-center gap-1 overflow-x-auto text-sm">
          {NAV.filter((n) => !n.admin || me.isAdmin).map((n) => {
            const active = location === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  active ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-1 w-full max-w-5xl mx-auto px-6 py-10"
      >
        {children}
      </motion.main>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

/**
 * Recovery UI for a PHI 403. Maps the server's gate codes to a calm explanation
 * plus the single next step the clinician should take.
 */
export function PhiNotice({ code, onChallenge }: { code: string | null; onChallenge?: () => void }) {
  if (code === "no_provider_profile") {
    return (
      <NoticeCard title="Complete your provider profile" body="Tell us who you are so we can begin verification.">
        <Link href="/care/onboarding" className="btn-primary">
          Set up profile
        </Link>
      </NoticeCard>
    );
  }
  if (code === "provider_unverified") {
    return (
      <NoticeCard
        title="Your account is awaiting verification"
        body="A member of our team reviews every clinician before any client information can be accessed. We will let you know by email once you are verified."
      />
    );
  }
  if (code === "two_factor_setup_required") {
    return (
      <NoticeCard
        title="Set up two-step verification"
        body="Client information is protected by a second factor. Enrol an authenticator app to continue."
      >
        <Link href="/care/security" className="btn-primary">
          Set up now
        </Link>
      </NoticeCard>
    );
  }
  if (code === "two_factor_challenge_required") {
    return (
      <NoticeCard
        title="Confirm it is you"
        body="For your clients' privacy, please re-enter a code from your authenticator app to continue."
      >
        {onChallenge && (
          <button type="button" onClick={onChallenge} className="btn-primary">
            Enter code
          </button>
        )}
      </NoticeCard>
    );
  }
  return null;
}

function NoticeCard({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4 max-w-lg mx-auto">
      <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mx-auto">
        <ShieldAlert className="w-5 h-5" />
      </div>
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      {children && <div className="pt-2 flex justify-center">{children}</div>}
    </div>
  );
}

/**
 * Modal to satisfy a two-factor challenge (or idle-timeout re-auth). Accepts an
 * authenticator code or a one-time recovery code, then calls onSuccess.
 */
export function TwoFactorChallenge({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/professional/security/totp/challenge", {
        method: "POST",
        body: JSON.stringify(useRecovery ? { recoveryCode: code.trim() } : { code: code.trim() }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not match");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-serif text-lg">Confirm it is you</h2>
        <p className="text-sm text-muted-foreground">
          {useRecovery
            ? "Enter one of your one-time recovery codes."
            : "Enter the current code from your authenticator app."}
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={useRecovery ? "recovery code" : "123456"}
          inputMode={useRecovery ? "text" : "numeric"}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono tracking-wider outline-none focus:ring-1 focus:ring-primary/50"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={busy || !code.trim()} className="btn-primary flex-1">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm">
            Cancel
          </button>
        </div>
        <button
          type="button"
          onClick={() => setUseRecovery((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {useRecovery ? "Use an authenticator code instead" : "Use a recovery code instead"}
        </button>
      </form>
    </div>
  );
}

/**
 * Wraps any PHI request so a mid-session `two_factor_challenge_required` 403
 * (e.g. after idle timeout) transparently opens the challenge modal and, on
 * success, retries the original request. Callers render `challengeElement` and
 * wrap their fetches in `guard(() => api(...))`. Cancelling rejects with the
 * original ApiError so callers can fall back to a notice.
 */
export function useTwoFactorGate() {
  const [challenging, setChallenging] = useState(false);
  // Multiple guarded requests can hit the challenge at once (e.g. a page that
  // loads several resources in parallel after an idle timeout). We queue every
  // blocked request and, on a single challenge, retry or cancel them all — a
  // single-slot state would otherwise strand all but the last request.
  const waitersRef = useRef<{ retry: () => void; cancel: () => void }[]>([]);

  const guard = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const attempt = (): Promise<T> =>
      fn().catch((e) => {
        if (e instanceof ApiError && e.status === 403 && e.code === "two_factor_challenge_required") {
          return new Promise<T>((resolve, reject) => {
            waitersRef.current.push({
              retry: () => attempt().then(resolve, reject),
              cancel: () => reject(e),
            });
            setChallenging(true);
          });
        }
        throw e;
      });
    return attempt();
  }, []);

  const resolveAll = useCallback((key: "retry" | "cancel") => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    setChallenging(false);
    waiters.forEach((w) => w[key]());
  }, []);

  const challengeElement = challenging ? (
    <TwoFactorChallenge onSuccess={() => resolveAll("retry")} onClose={() => resolveAll("cancel")} />
  ) : null;

  return { guard, challengeElement };
}
