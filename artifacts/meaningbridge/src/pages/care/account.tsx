import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Clock, XCircle, ShieldCheck, ShieldAlert, ArrowRight, Users, Send } from "lucide-react";
import {
  api,
  ApiError,
  Spinner,
  ErrorBanner,
  type ProviderProfile,
  type SecurityStatus,
} from "./provider-shell";

const STATUS_META = {
  pending: {
    icon: Clock,
    tone: "text-amber-600",
    title: "Awaiting verification",
    body: "A member of our team is reviewing your profile. We will email you once you are verified. You can update your details any time before then.",
  },
  verified: {
    icon: CheckCircle2,
    tone: "text-primary",
    title: "Verified",
    body: "Your account is verified. With two-step verification active, you can access client referrals and the colleague directory.",
  },
  rejected: {
    icon: XCircle,
    tone: "text-destructive",
    title: "Not verified",
    body: "We were unable to verify this profile. Please review your details and resubmit, or contact us if you believe this is a mistake.",
  },
} as const;

export default function ProviderAccount() {
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOptIn, setSavingOptIn] = useState(false);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([
        api<ProviderProfile>("/professional/providers/me"),
        api<SecurityStatus>("/professional/security"),
      ]);
      setProfile(p);
      setSecurity(s);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setLocation("/care/onboarding");
        return;
      }
      setError(e instanceof Error ? e.message : "Could not load your account");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleOptIn = async () => {
    if (!profile) return;
    setSavingOptIn(true);
    try {
      const updated = await api<ProviderProfile>("/professional/providers/me", {
        method: "PATCH",
        body: JSON.stringify({ directoryOptIn: !profile.directoryOptIn }),
      });
      setProfile(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setSavingOptIn(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!profile) return null;

  const meta = STATUS_META[profile.verificationStatus];
  const StatusIcon = meta.icon;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl">{profile.fullName || "Your practice"}</h1>
          {profile.credential && <p className="text-muted-foreground">{profile.credential}</p>}
        </div>
        <Link href="/care/onboarding" className="text-sm text-primary hover:underline whitespace-nowrap">
          Edit profile
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${meta.tone}`} />
          <h2 className="font-serif text-lg">{meta.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{meta.body}</p>
        {profile.verificationStatus === "rejected" && profile.verificationNote && (
          <p className="text-sm text-foreground/80 border-l-2 border-destructive/40 pl-3">
            {profile.verificationNote}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            {security?.totpEnabled ? (
              <ShieldCheck className="w-5 h-5 text-primary" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            )}
            <h2 className="font-serif text-lg">Two-step verification</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {security?.totpEnabled
              ? `Active. Sessions lock after ${security.idleTimeoutMinutes} minutes of inactivity.`
              : "Required before you can access client information."}
          </p>
          <Link href="/care/security" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            {security?.totpEnabled ? "Manage" : "Set up now"} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-lg">Colleague directory</h2>
          </div>
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={profile.directoryOptIn}
              disabled={savingOptIn}
              onChange={toggleOptIn}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            <span>List me in the directory once verified</span>
          </label>
          <Link href="/care/directory" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            Browse colleagues <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <Link
        href="/care/referrals"
        className="flex items-center justify-between rounded-xl border border-border bg-card p-6 hover:border-foreground/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-primary" />
          <div>
            <p className="font-serif text-lg">Referrals</p>
            <p className="text-sm text-muted-foreground">Send and receive client referrals with colleagues.</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
