import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute, useSearch, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Plus, ShieldAlert, X, Loader2 } from "lucide-react";
import {
  api,
  ApiError,
  Spinner,
  ErrorBanner,
  PhiNotice,
  useTwoFactorGate,
  type ProviderProfile,
} from "./provider-shell";

// --- reference data (client-side; cause categories come from /meta) ----------

const RELATIONSHIPS = [
  "Partner or spouse",
  "Child",
  "Parent",
  "Sibling",
  "Friend",
  "Grandparent",
  "Other",
];

const PREFERRED_CONTACT = ["Email", "Phone", "Text message"];

const TREATMENTS = ["Individual therapy", "Group therapy", "Psychiatry", "None"];

const GOALS = [
  "Continuing bonds work",
  "Meaning reconstruction",
  "Narrative & legacy work",
  "Between-session support",
  "Grief psychoeducation",
];

const ICD10 = [
  { code: "F43.81", label: "Prolonged grief disorder" },
  { code: "F43.21", label: "Adjustment disorder with depressed mood" },
  { code: "F43.22", label: "Adjustment disorder with anxiety" },
  { code: "F43.23", label: "Adjustment disorder, mixed anxiety and depressed mood" },
  { code: "F32.0", label: "Major depressive disorder, single episode, mild" },
  { code: "F32.1", label: "Major depressive disorder, single episode, moderate" },
  { code: "F32.9", label: "Major depressive disorder, single episode, unspecified" },
  { code: "F33.1", label: "Major depressive disorder, recurrent, moderate" },
  { code: "F41.1", label: "Generalized anxiety disorder" },
  { code: "F41.9", label: "Anxiety disorder, unspecified" },
  { code: "F43.10", label: "Post-traumatic stress disorder, unspecified" },
];

// --- form model --------------------------------------------------------------

interface IntakeForm {
  identity: {
    firstName: string;
    lastName: string;
    dob: string;
    pronouns: string;
    phone: string;
    email: string;
    preferredContact: string;
    emergencyName: string;
    emergencyPhone: string;
  };
  loss: { relationship: string; dateOfLoss: string; causeCategory: string };
  clinical: {
    pg13r: string;
    phq9: string;
    gad7: string;
    cssrsFlag: boolean;
    activeSuicidalIdeation: boolean;
    diagnoses: string;
    icd10: string[];
    medications: string;
    treatments: string[];
  };
  goals: { selected: string[]; freeText: string };
}

function emptyForm(): IntakeForm {
  return {
    identity: {
      firstName: "",
      lastName: "",
      dob: "",
      pronouns: "",
      phone: "",
      email: "",
      preferredContact: "Email",
      emergencyName: "",
      emergencyPhone: "",
    },
    loss: { relationship: "", dateOfLoss: "", causeCategory: "" },
    clinical: {
      pg13r: "",
      phq9: "",
      gad7: "",
      cssrsFlag: false,
      activeSuicidalIdeation: false,
      diagnoses: "",
      icd10: [],
      medications: "",
      treatments: [],
    },
    goals: { selected: [], freeText: "" },
  };
}

// Clearly-fictional sample used only for the no-network demo preview.
const PREVIEW_CAUSES = [
  "Illness",
  "Sudden medical event",
  "Accident",
  "Overdose",
  "Suicide",
  "Homicide",
  "Other",
];

const PREVIEW_PROVIDER: ProviderProfile = {
  id: 0,
  userId: 0,
  fullName: "Dr. Sarah Chen",
  credential: "MD",
  licenseNumber: "PSY-48213",
  licenseState: "OR",
  npi: "1234567893",
  practiceName: "Riverbend Psychiatric Associates",
  practiceAddress: "Portland, OR",
  verificationStatus: "verified",
  verificationNote: null,
  verifiedAt: null,
  directoryOptIn: false,
  specialtyTags: ["Complicated grief", "Trauma"],
  statesLicensed: ["OR", "WA"],
  telehealth: true,
  acceptingReferrals: true,
  bio: null,
};

const PREVIEW_INTAKE: IntakeForm = {
  identity: {
    firstName: "Marcus",
    lastName: "Webb",
    dob: "1972-03-14",
    pronouns: "he/him",
    phone: "(555) 010-4477",
    email: "marcus.webb@example.com",
    preferredContact: "Email",
    emergencyName: "Dana Webb",
    emergencyPhone: "(555) 010-8890",
  },
  loss: { relationship: "Partner or spouse", dateOfLoss: "2025-08-01", causeCategory: "Sudden medical event" },
  clinical: {
    pg13r: "34",
    phq9: "14",
    gad7: "9",
    cssrsFlag: false,
    activeSuicidalIdeation: false,
    diagnoses: "Prolonged grief disorder",
    icd10: ["F43.81"],
    medications: "Sertraline 100 mg",
    treatments: ["Individual therapy"],
  },
  goals: {
    selected: ["Continuing bonds work", "Narrative & legacy work"],
    freeText:
      "Marcus wants a place to talk to and about Elena between sessions; struggles most at night.",
  },
};

function fromData(data: Record<string, unknown>): IntakeForm {
  const f = emptyForm();
  const src = data as Partial<IntakeForm>;
  return {
    identity: { ...f.identity, ...(src.identity ?? {}) },
    loss: { ...f.loss, ...(src.loss ?? {}) },
    clinical: { ...f.clinical, ...(src.clinical ?? {}) },
    goals: { ...f.goals, ...(src.goals ?? {}) },
  };
}

function computeTimeSince(dateOfLoss: string): string | null {
  if (!dateOfLoss) return null;
  const then = new Date(dateOfLoss);
  if (Number.isNaN(then.getTime())) return null;
  const months =
    (new Date().getFullYear() - then.getFullYear()) * 12 +
    (new Date().getMonth() - then.getMonth());
  if (months < 0) return null;
  if (months < 1) return "Less than a month ago";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0
    ? `${years} year${years === 1 ? "" : "s"} ago`
    : `${years} year${years === 1 ? "" : "s"}, ${rem} month${rem === 1 ? "" : "s"} ago`;
}

interface Meta {
  causeOfLossCategories: string[];
}
interface IntakeView {
  id: number;
  data: Record<string, unknown>;
  riskFlag: boolean;
  safetyPlanConfirmed: boolean;
  status: string;
}

const STEPS = ["Referring provider", "Patient identity", "Loss & clinical", "Goals", "Consent"];

export default function ProviderIntake() {
  const [, params] = useRoute("/care/intake/:id");
  const routeId = params?.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();
  const isPreview = new URLSearchParams(useSearch()).get("preview") === "1";
  const { guard, challengeElement } = useTwoFactorGate();

  const [loading, setLoading] = useState(true);
  const [phiCode, setPhiCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [causes, setCauses] = useState<string[]>([]);
  const [form, setForm] = useState<IntakeForm>(emptyForm());
  const [intakeId, setIntakeId] = useState<number | null>(routeId);
  const [safetyPlanConfirmed, setSafetyPlanConfirmed] = useState(false);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewDone, setPreviewDone] = useState(false);

  const riskFlag = form.clinical.cssrsFlag || form.clinical.activeSuicidalIdeation;

  useEffect(() => {
    if (isPreview) {
      setProvider(PREVIEW_PROVIDER);
      setCauses(PREVIEW_CAUSES);
      setForm(PREVIEW_INTAKE);
      setLoading(false);
      return;
    }
    // Clear any sample data left over from a preview session before any live
    // save/submit is possible. For an existing intake (routeId set) the load
    // below overwrites the form; for a new intake we must reset here so preview
    // sample data can never be persisted to a real record.
    if (routeId === null) {
      setForm(emptyForm());
      setIntakeId(null);
      setSafetyPlanConfirmed(false);
    }
    setPreviewDone(false);
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPhiCode(null);
      setLoadError(null);
      try {
        const [meta, prov] = await Promise.all([
          api<Meta>("/professional/meta"),
          api<ProviderProfile>("/professional/providers/me"),
        ]);
        if (cancelled) return;
        setCauses(meta.causeOfLossCategories);
        setProvider(prov);

        if (routeId) {
          const intake = await guard(() => api<IntakeView>(`/professional/intakes/${routeId}`));
          if (cancelled) return;
          setForm(fromData(intake.data));
          setIntakeId(intake.id);
          setSafetyPlanConfirmed(intake.safetyPlanConfirmed);
        } else {
          // Probe the PHI gate so a verification / 2FA notice shows before the
          // provider invests time filling the form.
          await guard(() => api("/professional/intakes"));
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403 && err.code) {
          setPhiCode(err.code);
        } else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required")) {
          setLoadError(err instanceof Error ? err.message : "We could not open the intake form.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, isPreview]);

  function patchForm(section: keyof IntakeForm, values: Partial<IntakeForm[keyof IntakeForm]>) {
    setForm((f) => ({ ...f, [section]: { ...f[section], ...values } }));
    setSavedNote(null);
  }

  const dataBlob = useMemo(
    () => ({ identity: form.identity, loss: form.loss, clinical: form.clinical, goals: form.goals }),
    [form],
  );

  async function saveDraft(): Promise<number | null> {
    if (isPreview) {
      setSavedNote("Saved (preview)");
      return intakeId ?? 0;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (intakeId === null) {
        const created = await guard(() =>
          api<IntakeView>("/professional/intakes", {
            method: "POST",
            body: JSON.stringify({ status: "draft", data: dataBlob, riskFlag, safetyPlanConfirmed }),
          }),
        );
        setIntakeId(created.id);
        setSavedNote("Draft saved");
        return created.id;
      }
      await guard(() =>
        api(`/professional/intakes/${intakeId}`, {
          method: "PATCH",
          body: JSON.stringify({ data: dataBlob, riskFlag, safetyPlanConfirmed }),
        }),
      );
      setSavedNote("Draft saved");
      return intakeId;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) setPhiCode(err.code);
      else setFormError(err instanceof Error ? err.message : "We could not save your draft.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (step === 1 && !form.identity.firstName.trim()) {
      setFormError("A first name is needed to continue.");
      return;
    }
    const ok = await saveDraft();
    if (ok !== null) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function goToStep(target: number) {
    if (target === step || saving || submitting) return;
    setFormError(null);
    // Moving back is always allowed; persist the draft so nothing is lost.
    if (target < step) {
      await saveDraft();
      setStep(target);
      return;
    }
    // Moving forward past patient identity requires at least a first name.
    if (target > 1 && !form.identity.firstName.trim()) {
      setFormError("A first name is needed to continue.");
      setStep(1);
      return;
    }
    const ok = await saveDraft();
    if (ok !== null) setStep(target);
  }

  async function saveAndExit() {
    if (isPreview) {
      setLocation("/care/forms");
      return;
    }
    const ok = await saveDraft();
    // Only leave once the draft is safely persisted, so partially-entered PHI
    // is never silently lost.
    if (ok !== null) setLocation("/care/patients");
  }

  async function submit() {
    if (!form.identity.firstName.trim()) {
      setFormError("A first name is required before submitting.");
      setStep(1);
      return;
    }
    if (riskFlag && !safetyPlanConfirmed) {
      setFormError("Please confirm a safety plan is in place before submitting.");
      return;
    }
    if (isPreview) {
      setPreviewDone(true);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const id = await saveDraft();
      if (id === null) return;
      await guard(() => api(`/professional/intakes/${id}/submit`, { method: "POST" }));
      setLocation("/care/patients?enrolled=1");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) setPhiCode(err.code);
      else setFormError(err instanceof Error ? err.message : "We could not submit this intake.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;
  if (phiCode) return <PhiNotice code={phiCode} onChallenge={() => window.location.reload()} />;
  if (loadError) return <ErrorBanner message={loadError} />;

  if (isPreview && previewDone) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PreviewBanner />
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mx-auto">
            <Check className="w-5 h-5" />
          </div>
          <h2 className="font-serif text-xl">Preview complete</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            In real use, the patient would now receive a secure consent invite by email and this
            enrollment would appear as a draft on your roster. Nothing here was saved.
          </p>
          <div className="pt-1">
            <Link href="/care/forms" className="btn-primary inline-flex items-center gap-1.5">
              Back to intake forms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {challengeElement}

      {isPreview && <PreviewBanner />}

      <div className="space-y-2">
        <Link
          href={isPreview ? "/care/forms" : "/care/patients"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {isPreview ? "Back to intake forms" : "Back to patients"}
        </Link>
        <h1 className="font-serif text-3xl">Enroll a patient</h1>
        <p className="text-sm text-muted-foreground">
          Your entries are saved as an encrypted draft as you go. Consent is collected from the
          patient by email before their account activates.
        </p>
      </div>

      {/* stepper */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToStep(i)}
              disabled={saving || submitting}
              aria-current={i === step ? "step" : undefined}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={i === step ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="text-border">·</span>}
          </li>
        ))}
      </ol>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-xl border border-border bg-card p-6 md:p-8"
      >
        {step === 0 && <StepProvider provider={provider} />}
        {step === 1 && <StepIdentity form={form} patch={patchForm} />}
        {step === 2 && (
          <StepClinical
            form={form}
            patch={patchForm}
            causes={causes}
            riskFlag={riskFlag}
            safetyPlanConfirmed={safetyPlanConfirmed}
            setSafetyPlanConfirmed={(v) => {
              setSafetyPlanConfirmed(v);
              setSavedNote(null);
            }}
          />
        )}
        {step === 3 && <StepGoals form={form} patch={patchForm} />}
        {step === 4 && (
          <StepConsent
            form={form}
            riskFlag={riskFlag}
            safetyPlanConfirmed={safetyPlanConfirmed}
          />
        )}
      </motion.div>

      {formError && <ErrorBanner message={formError} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <button
            type="button"
            onClick={saveAndExit}
            disabled={saving}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Save & finish later
          </button>
          {savedNote && <span className="text-xs text-primary">{savedNote}</span>}
        </div>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !form.identity.email.trim() || (riskFlag && !safetyPlanConfirmed)}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit & send consent invite"}
          </button>
        )}
      </div>
    </div>
  );
}

// --- steps -------------------------------------------------------------------

function PreviewBanner() {
  return (
    <div className="rounded-md border border-primary/25 bg-accent/50 px-4 py-3 text-sm text-foreground/80">
      Preview of the patient enrollment intake — sample data, nothing here is saved.{" "}
      <Link href="/care/forms" className="text-primary hover:underline">
        Back to intake forms
      </Link>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm text-foreground mb-1.5">{children}</label>;
}

function StepProvider({ provider }: { provider: ProviderProfile | null }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl">Referring provider</h2>
        <p className="text-sm text-muted-foreground">Auto-filled from your verified account.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <ReadRow label="Name" value={provider?.fullName} />
        <ReadRow label="Credential" value={provider?.credential} />
        <ReadRow label="NPI" value={provider?.npi} />
        <ReadRow label="Practice" value={provider?.practiceName} />
        <ReadRow label="License" value={provider ? `${provider.licenseNumber ?? ""} ${provider.licenseState ?? ""}`.trim() : null} />
      </dl>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value || "—"}</dd>
    </div>
  );
}

function StepIdentity({
  form,
  patch,
}: {
  form: IntakeForm;
  patch: (s: keyof IntakeForm, v: Partial<IntakeForm[keyof IntakeForm]>) => void;
}) {
  const id = form.identity;
  const set = (v: Partial<IntakeForm["identity"]>) => patch("identity", v);
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Patient identity</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>First name</FieldLabel>
          <input className="input" value={id.firstName} onChange={(e) => set({ firstName: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Last name</FieldLabel>
          <input className="input" value={id.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Date of birth</FieldLabel>
          <input type="date" className="input" value={id.dob} onChange={(e) => set({ dob: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Pronouns (optional)</FieldLabel>
          <input className="input" value={id.pronouns} onChange={(e) => set({ pronouns: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <input className="input" value={id.phone} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input type="email" className="input" value={id.email} onChange={(e) => set({ email: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Preferred contact</FieldLabel>
          <select className="input" value={id.preferredContact} onChange={(e) => set({ preferredContact: e.target.value })}>
            {PREFERRED_CONTACT.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        The consent invite is sent to this email once the intake is submitted.
      </p>
      <div className="border-t border-border/60 pt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Emergency contact name</FieldLabel>
          <input className="input" value={id.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Emergency contact phone</FieldLabel>
          <input className="input" value={id.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function numeric(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function StepClinical({
  form,
  patch,
  causes,
  riskFlag,
  safetyPlanConfirmed,
  setSafetyPlanConfirmed,
}: {
  form: IntakeForm;
  patch: (s: keyof IntakeForm, v: Partial<IntakeForm[keyof IntakeForm]>) => void;
  causes: string[];
  riskFlag: boolean;
  safetyPlanConfirmed: boolean;
  setSafetyPlanConfirmed: (v: boolean) => void;
}) {
  const loss = form.loss;
  const c = form.clinical;
  const setLoss = (v: Partial<IntakeForm["loss"]>) => patch("loss", v);
  const setClin = (v: Partial<IntakeForm["clinical"]>) => patch("clinical", v);
  const [icdInput, setIcdInput] = useState("");
  const timeSince = computeTimeSince(loss.dateOfLoss);

  function addIcd() {
    const raw = icdInput.trim();
    if (!raw) return;
    const code = raw.split(/[\s—-]/)[0]!.toUpperCase();
    if (!c.icd10.includes(code)) setClin({ icd10: [...c.icd10, code] });
    setIcdInput("");
  }

  function toggleTreatment(t: string) {
    const has = c.treatments.includes(t);
    setClin({ treatments: has ? c.treatments.filter((x) => x !== t) : [...c.treatments, t] });
  }

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-xl">Loss & clinical context</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Relationship to the person who died</FieldLabel>
          <select className="input" value={loss.relationship} onChange={(e) => setLoss({ relationship: e.target.value })}>
            <option value="">Select…</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Cause of loss</FieldLabel>
          <select className="input" value={loss.causeCategory} onChange={(e) => setLoss({ causeCategory: e.target.value })}>
            <option value="">Select…</option>
            {causes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Date of loss</FieldLabel>
          <input type="date" className="input" value={loss.dateOfLoss} onChange={(e) => setLoss({ dateOfLoss: e.target.value })} />
          {timeSince && <p className="mt-1 text-xs text-muted-foreground">{timeSince}</p>}
        </div>
      </div>

      <div className="border-t border-border/60 pt-4 space-y-4">
        <p className="text-sm text-muted-foreground">Screening scores, if available (optional).</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>PG-13-R</FieldLabel>
            <input inputMode="numeric" className="input" value={c.pg13r} onChange={(e) => setClin({ pg13r: numeric(e.target.value) })} />
          </div>
          <div>
            <FieldLabel>PHQ-9</FieldLabel>
            <input inputMode="numeric" className="input" value={c.phq9} onChange={(e) => setClin({ phq9: numeric(e.target.value) })} />
          </div>
          <div>
            <FieldLabel>GAD-7</FieldLabel>
            <input inputMode="numeric" className="input" value={c.gad7} onChange={(e) => setClin({ gad7: numeric(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={c.cssrsFlag} onChange={(e) => setClin({ cssrsFlag: e.target.checked })} />
            C-SSRS risk flag present
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={c.activeSuicidalIdeation} onChange={(e) => setClin({ activeSuicidalIdeation: e.target.checked })} />
            Active suicidal ideation
          </label>
        </div>
      </div>

      {riskFlag && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-700" />
            <p className="text-sm text-amber-900">
              MeaningBridge is an adjunct to care, not a crisis service. It cannot respond to
              emergencies. Please confirm a safety plan is in place before enrolling this patient.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input type="checkbox" checked={safetyPlanConfirmed} onChange={(e) => setSafetyPlanConfirmed(e.target.checked)} />
            I confirm a safety plan exists for this patient.
          </label>
        </div>
      )}

      <div className="border-t border-border/60 pt-4 space-y-4">
        <div>
          <FieldLabel>Current diagnoses (free text)</FieldLabel>
          <textarea className="input min-h-[72px]" value={c.diagnoses} onChange={(e) => setClin({ diagnoses: e.target.value })} />
        </div>
        <div>
          <FieldLabel>ICD-10 codes</FieldLabel>
          <div className="flex gap-2">
            <input
              className="input"
              list="icd10-list"
              placeholder="Search a code…"
              value={icdInput}
              onChange={(e) => setIcdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addIcd();
                }
              }}
            />
            <datalist id="icd10-list">
              {ICD10.map((d) => (
                <option key={d.code} value={`${d.code} — ${d.label}`} />
              ))}
            </datalist>
            <button type="button" onClick={addIcd} className="inline-flex items-center gap-1 rounded-md border border-border px-3 text-sm hover:border-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {c.icd10.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.icd10.map((code) => (
                <span key={code} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs text-primary">
                  {code}
                  <button type="button" onClick={() => setClin({ icd10: c.icd10.filter((x) => x !== code) })}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <FieldLabel>Current medications (free text)</FieldLabel>
          <textarea className="input min-h-[60px]" value={c.medications} onChange={(e) => setClin({ medications: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Other current treatment</FieldLabel>
          <div className="flex flex-wrap gap-3">
            {TREATMENTS.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={c.treatments.includes(t)} onChange={() => toggleTreatment(t)} />
                {t}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepGoals({
  form,
  patch,
}: {
  form: IntakeForm;
  patch: (s: keyof IntakeForm, v: Partial<IntakeForm[keyof IntakeForm]>) => void;
}) {
  const g = form.goals;
  const toggle = (goal: string) => {
    const has = g.selected.includes(goal);
    patch("goals", { selected: has ? g.selected.filter((x) => x !== goal) : [...g.selected, goal] });
  };
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Goals for MeaningBridge</h2>
      <div className="space-y-2">
        {GOALS.map((goal) => (
          <label key={goal} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={g.selected.includes(goal)} onChange={() => toggle(goal)} />
            {goal}
          </label>
        ))}
      </div>
      <div>
        <FieldLabel>What would help most? (optional)</FieldLabel>
        <textarea className="input min-h-[96px]" value={g.freeText} onChange={(e) => patch("goals", { freeText: e.target.value })} />
      </div>
    </div>
  );
}

function StepConsent({
  form,
  riskFlag,
  safetyPlanConfirmed,
}: {
  form: IntakeForm;
  riskFlag: boolean;
  safetyPlanConfirmed: boolean;
}) {
  const email = form.identity.email.trim();
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Consent</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        On submit, {form.identity.firstName || "the patient"} is emailed a secure link to review a
        plain-language consent — how their information is used, what MeaningBridge can and cannot do,
        and that it does not replace therapy or emergency care — and to add their signature. Their
        status moves from <strong>Invited</strong> to <strong>Consented</strong> once they sign; you
        then activate their space.
      </p>
      {email ? (
        <div className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm">
          The invite will be sent to <span className="text-foreground">{email}</span>.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
          A patient email is required to submit. Return to the identity step and add one so the consent
          invite can be sent.
        </div>
      )}
      {riskFlag && !safetyPlanConfirmed && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
          Please return to the clinical step and confirm a safety plan is in place before submitting.
        </div>
      )}
    </div>
  );
}
