import { Link } from "wouter";
import { ArrowRight, Eye, ClipboardList, UserCog, FileSignature, type LucideIcon } from "lucide-react";

interface FormEntry {
  key: string;
  title: string;
  audience: string;
  description: string;
  icon: LucideIcon;
  entry: { href: string; label: string };
  preview: { href: string; label: string };
}

/**
 * A single index of every intake form in the clinician flow, each openable in
 * real "entry" mode and a no-network "demo preview". The preview links carry
 * `?preview=1` (or the /consent/preview sentinel token) so the forms render with
 * clearly-fictional sample data and never touch the network or save anything.
 */
const FORMS: FormEntry[] = [
  {
    key: "profile",
    title: "Clinician profile & verification",
    audience: "You complete this",
    description:
      "Your identity, license, NPI, and practice details. A member of our team reviews every clinician before any client information can be accessed.",
    icon: UserCog,
    entry: { href: "/care/onboarding", label: "Open form" },
    preview: { href: "/care/onboarding?preview=1", label: "Demo preview" },
  },
  {
    key: "intake",
    title: "Patient enrollment intake",
    audience: "You complete this for a patient",
    description:
      "A guided form capturing identity, the loss, clinical context, and goals. Everything saves as an encrypted draft as you go; on submit the patient receives a consent invite by email.",
    icon: ClipboardList,
    entry: { href: "/care/intake", label: "Open form" },
    preview: { href: "/care/intake?preview=1", label: "Demo preview" },
  },
  {
    key: "consent",
    title: "Patient consent",
    audience: "Your patient completes this",
    description:
      "A plain-language consent the patient reviews and signs by secure email link. Nothing activates, and nothing reaches you, until it is signed.",
    icon: FileSignature,
    entry: { href: "/care/patients", label: "Track consent status" },
    preview: { href: "/consent/preview", label: "Demo preview" },
  },
];

export default function ProviderForms() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl">Intake forms</h1>
        <p className="text-muted-foreground leading-relaxed">
          Every form in the enrollment flow, in one place. Open a form to complete it, or view a
          demo preview with sample data — previews never save anything.
        </p>
      </div>

      <div className="space-y-4">
        {FORMS.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.key} className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-accent flex items-center justify-center text-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{f.audience}</p>
                  <h2 className="font-serif text-xl">{f.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pl-14">
                <Link href={f.entry.href} className="btn-primary inline-flex items-center gap-1.5">
                  {f.entry.label} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={f.preview.href}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> {f.preview.label}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
