import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Check, ShieldCheck, AlertCircle } from "lucide-react";
import { api, ApiError, ErrorBanner, type ProviderProfile } from "./provider-shell";

interface NpiResult {
  valid: boolean;
  registry: { found: boolean; name?: string; credential?: string; state?: string };
}

interface FormState {
  fullName: string;
  credential: string;
  licenseNumber: string;
  licenseState: string;
  npi: string;
  practiceName: string;
  practiceAddress: string;
  specialtyTags: string;
  statesLicensed: string;
  telehealth: boolean;
  acceptingReferrals: boolean;
  bio: string;
  directoryOptIn: boolean;
}

const EMPTY: FormState = {
  fullName: "",
  credential: "",
  licenseNumber: "",
  licenseState: "",
  npi: "",
  practiceName: "",
  practiceAddress: "",
  specialtyTags: "",
  statesLicensed: "",
  telehealth: false,
  acceptingReferrals: true,
  bio: "",
  directoryOptIn: false,
};

function toCsv(arr: string[]): string {
  return arr.join(", ");
}
function fromCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function ProviderOnboarding() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [existing, setExisting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attested, setAttested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [npi, setNpi] = useState<{ checking: boolean; result: NpiResult | null }>({
    checking: false,
    result: null,
  });
  const npiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await api<ProviderProfile>("/professional/providers/me");
        setExisting(true);
        setAttested(true);
        setForm({
          fullName: p.fullName ?? "",
          credential: p.credential ?? "",
          licenseNumber: p.licenseNumber ?? "",
          licenseState: p.licenseState ?? "",
          npi: p.npi ?? "",
          practiceName: p.practiceName ?? "",
          practiceAddress: p.practiceAddress ?? "",
          specialtyTags: toCsv(p.specialtyTags),
          statesLicensed: toCsv(p.statesLicensed),
          telehealth: p.telehealth,
          acceptingReferrals: p.acceptingReferrals,
          bio: p.bio ?? "",
          directoryOptIn: p.directoryOptIn,
        });
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) {
          setError(e instanceof Error ? e.message : "Could not load profile");
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const checkNpi = (value: string) => {
    set("npi", value);
    setNpi({ checking: false, result: null });
    if (npiTimer.current) clearTimeout(npiTimer.current);
    const trimmed = value.trim();
    if (trimmed.length !== 10) return;
    npiTimer.current = setTimeout(async () => {
      setNpi({ checking: true, result: null });
      try {
        const r = await api<NpiResult>(`/professional/providers/npi-lookup?npi=${encodeURIComponent(trimmed)}`);
        setNpi({ checking: false, result: r });
      } catch {
        setNpi({ checking: false, result: null });
      }
    }, 500);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attested || !form.fullName.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      fullName: form.fullName.trim(),
      credential: form.credential.trim() || undefined,
      licenseNumber: form.licenseNumber.trim() || undefined,
      licenseState: form.licenseState.trim() || undefined,
      npi: form.npi.trim() || undefined,
      practiceName: form.practiceName.trim() || undefined,
      practiceAddress: form.practiceAddress.trim() || undefined,
      specialtyTags: fromCsv(form.specialtyTags),
      statesLicensed: fromCsv(form.statesLicensed),
      telehealth: form.telehealth,
      acceptingReferrals: form.acceptingReferrals,
      bio: form.bio.trim() || undefined,
      directoryOptIn: form.directoryOptIn,
    };
    try {
      await api<ProviderProfile>(existing ? "/professional/providers/me" : "/professional/providers", {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setLocation("/care/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-3">
        <h1 className="font-serif text-3xl">{existing ? "Your provider profile" : "Set up your provider profile"}</h1>
        <p className="text-muted-foreground leading-relaxed">
          Tell us about your practice. A member of our team reviews every clinician before any client
          information can be accessed.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={submit} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <Field label="Full name" required>
            <input className="input" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Credential" hint="e.g. LCSW, PhD, LPC">
              <input className="input" value={form.credential} onChange={(e) => set("credential", e.target.value)} />
            </Field>
            <Field label="NPI" hint="10-digit National Provider Identifier">
              <input
                className="input font-mono"
                value={form.npi}
                onChange={(e) => checkNpi(e.target.value)}
                maxLength={10}
              />
              {npi.checking && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking registry...
                </p>
              )}
              {!npi.checking && npi.result && (
                <p
                  className={`text-xs flex items-center gap-1.5 pt-1 ${
                    npi.result.valid ? "text-primary" : "text-destructive"
                  }`}
                >
                  {npi.result.valid ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {npi.result.valid
                    ? npi.result.registry.found
                      ? `Matched: ${npi.result.registry.name ?? "registered provider"}`
                      : "Valid format and checksum"
                    : "That NPI is not valid"}
                </p>
              )}
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="License number">
              <input className="input" value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} />
            </Field>
            <Field label="License state" hint="Two-letter code, e.g. TN">
              <input
                className="input"
                value={form.licenseState}
                onChange={(e) => set("licenseState", e.target.value.toUpperCase())}
                maxLength={2}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <Field label="Practice name">
            <input className="input" value={form.practiceName} onChange={(e) => set("practiceName", e.target.value)} />
          </Field>
          <Field label="Practice address">
            <input className="input" value={form.practiceAddress} onChange={(e) => set("practiceAddress", e.target.value)} />
          </Field>
          <Field label="Specialties" hint="Comma-separated, e.g. Complicated grief, Trauma">
            <input className="input" value={form.specialtyTags} onChange={(e) => set("specialtyTags", e.target.value)} />
          </Field>
          <Field label="States licensed" hint="Comma-separated two-letter codes, e.g. TN, GA">
            <input
              className="input"
              value={form.statesLicensed}
              onChange={(e) => set("statesLicensed", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="About your practice">
            <textarea
              className="input min-h-[96px] resize-y"
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
            />
          </Field>
          <div className="space-y-3">
            <Toggle checked={form.telehealth} onChange={(v) => set("telehealth", v)} label="I offer telehealth" />
            <Toggle
              checked={form.acceptingReferrals}
              onChange={(v) => set("acceptingReferrals", v)}
              label="I am currently accepting referrals"
            />
            <Toggle
              checked={form.directoryOptIn}
              onChange={(v) => set("directoryOptIn", v)}
              label="List me in the colleague directory once verified"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-accent/40 p-5 cursor-pointer">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span className="space-y-1">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck className="w-4 h-4 text-primary" /> Professional attestation
            </span>
            <span className="block text-xs text-muted-foreground leading-relaxed">
              I confirm that the information above is accurate and that I am a licensed grief-care
              professional. I understand that client records in this portal contain protected health
              information, that access requires verification and two-step verification, and that my
              use is governed by the applicable Business Associate Agreement.
            </span>
          </span>
        </label>

        <button type="submit" disabled={saving || !attested || !form.fullName.trim()} className="btn-primary w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {existing ? "Save changes" : "Submit for verification"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      <span>{label}</span>
    </label>
  );
}
