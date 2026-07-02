import { Activity, CalendarClock, MessageSquare } from "lucide-react";

/**
 * The single, clearly-fictional worked example from the build spec. It renders
 * ONLY inside an explicit Demo mode and is always watermarked "SAMPLE —
 * FICTIONAL" so it can never be mistaken for a real enrolled client. No real
 * PHI ever flows through this constant.
 */
export const MARCUS_SAMPLE = {
  referringProvider: {
    name: "Dr. Sarah Chen, MD",
    specialty: "Psychiatry",
    npi: "1234567893",
    practice: "Riverbend Psychiatric Associates",
    location: "Portland, OR",
  },
  patient: {
    name: "Marcus Webb",
    dob: "03/14/1972",
    pronouns: "he/him",
    preferredContact: "Email",
  },
  loss: {
    relationship: "Wife, Elena",
    timeSince: "11 months ago",
    cause: "Sudden medical event (aortic dissection)",
  },
  clinical: {
    scores: "PG-13-R 34 (above threshold), PHQ-9 14, GAD-7 9, C-SSRS: no active ideation",
    diagnosis: "F43.81 Prolonged grief disorder",
    medications: "Sertraline 100 mg",
    treatment: "Biweekly individual therapy",
  },
  goals: {
    selected: ["Continuing bonds work", "Narrative & legacy work"],
    note: "Marcus wants a place to talk to and about Elena between sessions; struggles most at night.",
  },
  status: "Active",
  consentSignedAt: "07/01/2026",
  engagement: {
    sessionCount: 6,
    lastActive: "2 days ago",
  },
} as const;

function Watermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <span className="select-none rotate-[-18deg] text-4xl md:text-5xl font-serif tracking-[0.3em] text-foreground/[0.06] whitespace-nowrap">
        SAMPLE — FICTIONAL
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

/**
 * A read-only card presenting the Marcus Webb worked example. Used on the public
 * caregiver marketing page and the authenticated dashboard's Demo mode toggle.
 */
export function DemoPatientCard() {
  const s = MARCUS_SAMPLE;
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300/50 bg-amber-50/40 p-6 md:p-8">
      <Watermark />
      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-200/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-900">
            Sample — fictional
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {s.status}
          </span>
          <span className="text-xs text-muted-foreground">
            Consent e-signed {s.consentSignedAt}
          </span>
        </div>

        <div>
          <h3 className="font-serif text-2xl">{s.patient.name}</h3>
          <p className="text-sm text-muted-foreground">
            {s.patient.dob} · {s.patient.pronouns} · prefers {s.patient.preferredContact.toLowerCase()}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <dl className="space-y-2">
            <Row label="Referred by" value={`${s.referringProvider.name}, ${s.referringProvider.specialty}`} />
            <Row label="Practice" value={`${s.referringProvider.practice}, ${s.referringProvider.location}`} />
            <Row label="NPI" value={s.referringProvider.npi} />
          </dl>
          <dl className="space-y-2">
            <Row label="Loss" value={`${s.loss.relationship} · ${s.loss.timeSince}`} />
            <Row label="Cause" value={s.loss.cause} />
            <Row label="Diagnosis" value={s.clinical.diagnosis} />
            <Row label="Medications" value={s.clinical.medications} />
            <Row label="Treatment" value={s.clinical.treatment} />
          </dl>
        </div>

        <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Screening (as referred)</p>
          <p className="text-sm text-foreground">{s.clinical.scores}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Goals for MeaningBridge</p>
          <div className="flex flex-wrap gap-2">
            {s.goals.selected.map((g) => (
              <span key={g} className="rounded-full bg-accent px-3 py-1 text-xs text-primary">
                {g}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground italic">&ldquo;{s.goals.note}&rdquo;</p>
        </div>

        <div className="border-t border-border/60 pt-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            Engagement (metadata only — never conversation content)
          </p>
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="inline-flex items-center gap-2 text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              {s.engagement.sessionCount} sessions started
            </span>
            <span className="inline-flex items-center gap-2 text-foreground">
              <CalendarClock className="h-4 w-4 text-primary" />
              Last active {s.engagement.lastActive}
            </span>
            <span className="inline-flex items-center gap-2 text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              {s.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
