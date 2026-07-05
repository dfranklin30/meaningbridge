import { ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  Wind,
  Calendar,
  Clock,
  HeartHandshake,
  ShieldCheck,
  Mail,
  Phone,
  Users,
  ClipboardList,
  Bell,
  BookOpen,
  BarChart3,
  Share2,
  Lock,
  CheckCircle2,
  MessagesSquare,
  Link2,
  Upload,
  Compass,
  PenLine,
  Eye,
} from "lucide-react";
import { Logo } from "@/components/logo";
import lovedOne1 from "@/assets/demo/loved-one-1.png";
import lovedOne2 from "@/assets/demo/loved-one-2.png";
import lovedOne3 from "@/assets/demo/loved-one-3.png";
import lovedOne4 from "@/assets/demo/loved-one-4.png";

// A public, no-login guided tour of every feature, with an explanation and an
// on-brand illustrative example for each. Split into the two audiences the
// product serves. Examples are representative illustrations, not live data.

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

type Accent = "teal" | "navy";

function FeatureRow({
  n,
  title,
  blurb,
  accent,
  children,
}: {
  n: number;
  title: string;
  blurb: string;
  accent: Accent;
  children: ReactNode;
}) {
  const numberCls =
    accent === "teal"
      ? "text-brand-teal border-brand-teal/30"
      : "text-brand-navy border-brand-navy/30";
  return (
    <motion.div
      {...fade}
      className="grid md:grid-cols-2 gap-8 md:gap-12 items-center py-12 border-t border-border/60"
    >
      <div>
        <div
          className={`inline-flex items-center justify-center w-10 h-10 rounded-full border font-serif text-lg mb-4 ${numberCls}`}
        >
          {n}
        </div>
        <h3 className="font-serif text-2xl md:text-[1.7rem] text-foreground mb-3">
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed max-w-md">{blurb}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </motion.div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_20px_60px_-30px_hsl(215_50%_30%/0.25)]">
      {children}
    </div>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "user" | "companion";
  children: ReactNode;
}) {
  return (
    <div className={`flex ${side === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          side === "user"
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "teal" | "navy" }) {
  const cls =
    tone === "teal"
      ? "bg-brand-teal/10 text-brand-teal"
      : tone === "navy"
        ? "bg-brand-navy/10 text-brand-navy"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

// --- Small illustrative visuals ------------------------------------------

function MiniRadar() {
  // Simple pentagon radar illustration (5 factors).
  const cx = 70;
  const cy = 66;
  const r = 52;
  const pts = (scale: number) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `${cx + Math.cos(a) * r * scale},${cy + Math.sin(a) * r * scale}`;
    }).join(" ");
  const value = [0.8, 0.55, 0.7, 0.5, 0.75];
  const valuePts = value
    .map((v, i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `${cx + Math.cos(a) * r * v},${cy + Math.sin(a) * r * v}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36">
      {[1, 0.66, 0.33].map((s) => (
        <polygon
          key={s}
          points={pts(s)}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity={0.2}
        />
      ))}
      <polygon
        points={valuePts}
        fill="hsl(var(--brand-teal))"
        fillOpacity={0.25}
        stroke="hsl(var(--brand-teal))"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function BreathPacer() {
  return (
    <div className="flex flex-col items-center justify-center py-2">
      <motion.div
        animate={{ scale: [1, 1.35, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="w-24 h-24 rounded-full bg-brand-teal/15 border border-brand-teal/30 flex items-center justify-center"
      >
        <Wind className="w-6 h-6 text-brand-teal" />
      </motion.div>
      <span className="text-xs text-muted-foreground mt-3">Breathe in, and slowly out.</span>
    </div>
  );
}

function TierBadge({ tier }: { tier: "Companion" | "Enhanced" | "Specialist" }) {
  const cls =
    tier === "Companion"
      ? "bg-brand-teal/10 text-brand-teal"
      : tier === "Enhanced"
        ? "bg-amber-500/10 text-amber-700"
        : "bg-brand-navy/10 text-brand-navy";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{tier}</span>;
}

// --- Feature data ---------------------------------------------------------

interface Feature {
  n: number;
  title: string;
  blurb: string;
  example: ReactNode;
}

const grieving: Feature[] = [
  {
    n: 1,
    title: "A gentle beginning",
    blurb:
      "Onboarding starts with the person you are remembering, not a form. A short, trauma-informed self-reflection quietly shapes the support you receive. You are never shown a score.",
    example: (
      <Frame>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Getting to know you</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Who are you remembering?</label>
            <div className="mt-1 h-9 rounded-lg border border-border bg-background px-3 flex items-center text-sm text-foreground/80">
              Margaret, my mother
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((d) => (
              <span
                key={d}
                className={`h-2.5 flex-1 rounded-full ${d <= 3 ? "bg-brand-teal/50" : "bg-muted"}`}
              />
            ))}
          </div>
          <Chip tone="teal">
            <ShieldCheck className="w-3.5 h-3.5" /> We turn numbers into narratives
          </Chip>
        </div>
      </Frame>
    ),
  },
  {
    n: 2,
    title: "Two AI companions",
    blurb:
      "Grounded in Dr. Neimeyer's work: a Continuing Bonds companion for staying connected, and a Meaning Reconstruction companion for rebuilding your story. They stream their replies gently and never claim to be human.",
    example: (
      <Frame>
        <div className="flex gap-2 mb-4">
          <Chip tone="teal">Continuing Bonds</Chip>
          <Chip tone="navy">Meaning Reconstruction</Chip>
        </div>
        <div className="space-y-2.5">
          <Bubble side="user">I keep talking to her out of habit.</Bubble>
          <Bubble side="companion">
            That habit is a form of love. What is something you wish you could tell her today?
          </Bubble>
        </div>
      </Frame>
    ),
  },
  {
    n: 3,
    title: "Journaling with prompts",
    blurb:
      "A quiet place to write, with reflective prompts when the page feels blank. You can speak instead of type — your voice becomes text you can review before saving.",
    example: (
      <Frame>
        <Chip tone="teal">
          <BookOpen className="w-3.5 h-3.5" /> Prompt: A memory that made you smile
        </Chip>
        <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
          The way she hummed while making tea in the morning...
        </p>
        <div className="mt-4 flex items-center gap-2 text-brand-teal">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal/30 px-3 py-1 text-xs">
            <Mic className="w-3.5 h-3.5" /> Speak your entry
          </span>
        </div>
      </Frame>
    ),
  },
  {
    n: 4,
    title: "Self-guided practices",
    blurb:
      "Short, calming practices — including breathwork with a visual pacer that gently guides the rhythm of each breath.",
    example: (
      <Frame>
        <BreathPacer />
      </Frame>
    ),
  },
  {
    n: 5,
    title: "Reflective inventory",
    blurb:
      "A deeper, reflective self-reflection (the Grief & Meaning Reconstruction Inventory) rendered as a living radar across five facets of meaning — a way to notice where you are, never a test to pass.",
    example: (
      <Frame>
        <div className="flex items-center gap-5">
          <MiniRadar />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Five facets of meaning after loss, from continuing bonds to a
              renewed sense of peace.
            </p>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    n: 6,
    title: "Daily check-in",
    blurb:
      "A one-moment way to note how today feels. Over time it becomes a quiet record of the tides of grief.",
    example: (
      <Frame>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">How is today?</p>
        <div className="flex flex-wrap gap-2">
          {["Heavy", "Tender", "Steady", "Grateful", "Numb"].map((w, i) => (
            <span
              key={w}
              className={`rounded-full px-3 py-1.5 text-sm ${
                i === 1 ? "bg-brand-teal/15 text-brand-teal" : "bg-muted text-muted-foreground"
              }`}
            >
              {w}
            </span>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    n: 7,
    title: "Your insights",
    blurb:
      "A calm dashboard that reflects your journey back to you as a warm sentence and a few gentle snapshots — the shift from numbers to narratives.",
    example: (
      <Frame>
        <p className="font-serif text-lg text-foreground leading-snug">
          You are carrying a great deal right now, and reaching out is a strength.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="w-4 h-4 text-brand-teal" /> Meaning
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HeartHandshake className="w-4 h-4 text-brand-teal" /> Connection
          </div>
        </div>
      </Frame>
    ),
  },
  {
    n: 8,
    title: "A profile of your loved one",
    blurb:
      "A dedicated space to hold who they were — their story and their photographs, kept private to you.",
    example: (
      <Frame>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-brand-teal/15 flex items-center justify-center text-brand-teal font-serif text-lg">
            M
          </div>
          <div>
            <p className="font-serif text-foreground">Margaret</p>
            <p className="text-xs text-muted-foreground">Mother, gardener, storyteller</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[lovedOne1, lovedOne2, lovedOne3, lovedOne4].map((src, i) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    n: 9,
    title: "Find a therapist",
    blurb:
      "When you are ready for human support, a locator helps you find grief-informed professionals.",
    example: (
      <Frame>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-navy/10 flex items-center justify-center text-brand-navy text-sm font-medium">
              DR
            </div>
            <div>
              <p className="text-sm text-foreground">Dr. Rivera, LCSW</p>
              <p className="text-xs text-muted-foreground">Grief &amp; bereavement · Telehealth</p>
            </div>
          </div>
          <span className="text-xs text-brand-teal">View</span>
        </div>
      </Frame>
    ),
  },
  {
    n: 10,
    title: "Book a session",
    blurb:
      "Book real appointments through a HIPAA-covered scheduling system. First sessions unlock only after your intake and consent forms are signed — care with a gentle floor.",
    example: (
      <Frame>
        <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs">
          <Chip tone="navy">Type</Chip>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Chip tone="navy">Time</Chip>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Chip tone="navy">Details</Chip>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Chip tone="navy">Confirm</Chip>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["9:00", "10:30", "1:00", "2:30", "4:00", "5:30"].map((t, i) => (
            <div
              key={t}
              className={`rounded-lg border px-2 py-1.5 text-center text-sm ${
                i === 2
                  ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                  : "border-border text-foreground/70"
              }`}
            >
              {t}
            </div>
          ))}
        </div>
        <Chip tone="teal">
          <CheckCircle2 className="w-3.5 h-3.5" /> Intake &amp; consent signed
        </Chip>
      </Frame>
    ),
  },
  {
    n: 11,
    title: "Crisis support, always",
    blurb:
      "A calm, ever-present link to immediate help. Every message is quietly watched for distress, and support is offered softly — never with alarm.",
    example: (
      <Frame>
        <div className="flex items-start gap-3">
          <HeartHandshake className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <p className="text-sm text-foreground">If things feel like too much, you are not alone.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reach a trained counselor any time, day or night.
            </p>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    n: 12,
    title: "Companion check-ins",
    blurb:
      "The companion can reach out gently between visits — by email or verified text message — on a rhythm you choose, and never past your quiet hours.",
    example: (
      <Frame>
        <div className="flex gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal/10 text-brand-teal px-3 py-1 text-xs">
            <Mail className="w-3.5 h-3.5" /> Email
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs">
            <Phone className="w-3.5 h-3.5" /> Text
          </span>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Thinking of you today. No need to reply — I am here whenever you would like to talk.
        </p>
      </Frame>
    ),
  },
  {
    n: 13,
    title: "A community that understands",
    blurb:
      "Real-time, gently moderated rooms where you can sit with others who are grieving. You choose a screen name and share only what feels right, every message is quietly watched for distress, and your companion can suggest the room that fits where you are.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 mb-3 text-brand-teal">
          <MessagesSquare className="w-4 h-4" />
          <span className="text-sm font-medium">Losing a parent</span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> 8 here now
          </span>
        </div>
        <div className="space-y-2.5">
          <Bubble side="companion">
            Some mornings are heavier than others. You are not alone in that here.
          </Bubble>
          <Bubble side="user">Thank you. It helps to read that today.</Bubble>
        </div>
      </Frame>
    ),
  },
  {
    n: 14,
    title: "Connect with your clinician",
    blurb:
      "If you are working with a grief-informed professional, you can link your account to theirs, so the care you receive in person and the support you find here move together. You choose what to share, and can disconnect at any time.",
    example: (
      <Frame>
        <div className="flex items-center gap-3">
          <Link2 className="w-5 h-5 text-brand-teal" />
          <div>
            <p className="text-sm text-foreground">Connected to Dr. Rivera, LCSW</p>
            <p className="text-xs text-muted-foreground">
              You choose what to share, and can disconnect any time.
            </p>
          </div>
        </div>
      </Frame>
    ),
  },
];

const professionals: Feature[] = [
  {
    n: 1,
    title: "Hold the space between sessions",
    blurb:
      "MeaningBridge gives the people in your care a gentle companion for grief between appointments — an adjunct to your care, never a replacement for it.",
    example: (
      <Frame>
        <p className="font-serif text-xl text-foreground leading-snug">
          You enroll them, they consent, and you see engagement — never the words they write.
        </p>
      </Frame>
    ),
  },
  {
    n: 2,
    title: "Enroll from a short intake",
    blurb:
      "A guided form captures identity, the loss, clinical context, and goals. Your details auto-fill from your verified account, and everything saves as you go.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 mb-3 text-brand-navy">
          <ClipboardList className="w-4 h-4" />
          <span className="text-sm font-medium">New patient intake</span>
        </div>
        <div className="space-y-2">
          {["Identity & contact", "The loss", "Clinical context", "Goals of care"].map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <CheckCircle2
                className={`w-4 h-4 ${i < 2 ? "text-brand-teal" : "text-muted-foreground/40"}`}
              />
              <span className={i < 2 ? "text-foreground" : "text-muted-foreground"}>{s}</span>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    n: 3,
    title: "Consent comes from the patient",
    blurb:
      "On submit, the patient receives a secure link to review a plain-language consent and add their signature. Nothing activates until they sign — consent is the floor.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-brand-navy" />
          <span className="text-foreground">Consent request sent</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="h-2 flex-1 rounded-full bg-brand-teal/50" />
          <span className="h-2 flex-1 rounded-full bg-brand-teal/50" />
          <span className="h-2 flex-1 rounded-full bg-muted" />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Awaiting the patient's signature.</p>
      </Frame>
    ),
  },
  {
    n: 4,
    title: "A roster you can read at a glance",
    blurb:
      "Your patients with support tiers and consent status — a quiet, honest read that helps you step in when it matters.",
    example: (
      <Frame>
        <div className="space-y-2.5">
          {[
            { name: "A. Chen", tier: "Companion" as const, consent: true },
            { name: "M. Okafor", tier: "Enhanced" as const, consent: true },
            { name: "R. Silva", tier: "Specialist" as const, consent: false },
          ].map((p) => (
            <div key={p.name} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{p.name}</span>
              <div className="flex items-center gap-2">
                <TierBadge tier={p.tier} />
                <span
                  className={`w-2 h-2 rounded-full ${p.consent ? "bg-brand-teal" : "bg-muted-foreground/40"}`}
                  title={p.consent ? "Consented" : "Awaiting consent"}
                />
              </div>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    n: 5,
    title: "Engagement, not eavesdropping",
    blurb:
      "You see that someone is engaging and how they are trending — never the private words they write. Minimum necessary, by design.",
    example: (
      <Frame>
        <div className="flex items-end gap-1 h-16">
          {[5, 8, 6, 10, 7, 12, 9].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-brand-navy/50"
              style={{ height: `${h * 6}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Weekly engagement · content stays private</p>
      </Frame>
    ),
  },
  {
    n: 6,
    title: "Safety signals",
    blurb:
      "When the system detects distress, it surfaces a calm, aggregated count so you can reach out — without exposing the underlying messages.",
    example: (
      <Frame>
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm text-foreground">2 gentle safety flags this week</p>
            <p className="text-xs text-muted-foreground">Consider a check-in with R. Silva.</p>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    n: 7,
    title: "Referrals between professionals",
    blurb:
      "Refer a patient to a colleague with a release of information and track the status end to end.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 mb-2 text-brand-navy">
          <Share2 className="w-4 h-4" />
          <span className="text-sm font-medium">Referral to Dr. Rivera</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Chip tone="teal">
            <CheckCircle2 className="w-3.5 h-3.5" /> ROI on file
          </Chip>
          <Chip tone="navy">Accepted</Chip>
        </div>
      </Frame>
    ),
  },
  {
    n: 8,
    title: "A professional directory",
    blurb:
      "Search grief-informed colleagues by specialty, state, and availability to build your referral network.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span className="text-sm">Grief specialists · Oregon</span>
        </div>
        <div className="space-y-2">
          {["Dr. Rivera, LCSW", "Dr. Adeyemi, PhD"].map((n) => (
            <div key={n} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{n}</span>
              <span className="text-xs text-brand-teal">Available</span>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },
  {
    n: 9,
    title: "Security built in",
    blurb:
      "The clinician portal is protected by verification and two-factor authentication before any patient information is shown.",
    example: (
      <Frame>
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-brand-navy" />
          <div>
            <p className="text-sm text-foreground">Two-factor verification</p>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <span key={d} className="w-6 h-8 rounded border border-border bg-background" />
              ))}
            </div>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    n: 10,
    title: "Verification & audit",
    blurb:
      "Clinicians are verified before activation, and privileged access is recorded — accountability that protects everyone.",
    example: (
      <Frame>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-teal" />
            <span className="text-foreground">License verified · NPI on file</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ClipboardList className="w-4 h-4" />
            <span>Access log recorded</span>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    n: 11,
    title: "Calendar sync",
    blurb:
      "Appointments flow to your Google Calendar, with every write confirmed so nothing fails silently.",
    example: (
      <Frame>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-brand-navy" />
          <div>
            <p className="text-sm text-foreground">Thu · 1:00 PM — A. Chen</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-brand-teal mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Synced to Google Calendar
            </span>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    n: 12,
    title: "A booking gate that protects care",
    blurb:
      "First sessions unlock only once the required intake and consent forms are signed — so care always begins on solid ground.",
    example: (
      <Frame>
        <div className="space-y-2 text-sm">
          {[
            { label: "Intake form", done: true },
            { label: "Consent to treatment", done: true },
            { label: "Telehealth consent", done: false },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <CheckCircle2
                className={`w-4 h-4 ${f.done ? "text-brand-teal" : "text-muted-foreground/40"}`}
              />
              <span className={f.done ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Booking opens when all are signed.</span>
        </div>
      </Frame>
    ),
  },
  {
    n: 13,
    title: "Bring your caseload with you",
    blurb:
      "Import the people already in your care from a simple file, so you can begin without re-entering everyone by hand. Consent is still requested from each patient before anything activates.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 mb-3 text-brand-navy">
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">Import patients</span>
        </div>
        <div className="space-y-2 text-sm">
          {["roster.csv · 24 rows", "Matched to your account", "Consent requests queued"].map(
            (s, i) => (
              <div key={s} className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${i < 2 ? "text-brand-teal" : "text-muted-foreground/40"}`}
                />
                <span className={i < 2 ? "text-foreground" : "text-muted-foreground"}>{s}</span>
              </div>
            ),
          )}
        </div>
      </Frame>
    ),
  },
];

const publicWays: Feature[] = [
  {
    n: 1,
    title: "Explore before you decide",
    blurb:
      "This guided tour, and a hands-on sandbox, let you walk through the whole experience without an account, from either side.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 mb-3 text-brand-teal">
          <Compass className="w-4 h-4" />
          <span className="text-sm font-medium">A guided tour</span>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Every feature, one at a time, with a gentle example, and no sign-in required.
        </p>
      </Frame>
    ),
  },
  {
    n: 2,
    title: "Plans that meet the need",
    blurb:
      "Support is offered in tiers that match the level of care — Companion, Enhanced, and Specialist — so people find the right depth of support.",
    example: (
      <Frame>
        <div className="flex flex-wrap gap-2">
          <TierBadge tier="Companion" />
          <TierBadge tier="Enhanced" />
          <TierBadge tier="Specialist" />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Each tier maps to the level of support, and is never shown as a score.
        </p>
      </Frame>
    ),
  },
  {
    n: 3,
    title: "Stay in the loop",
    blurb:
      "Not ready yet? Leave an email to be gently notified at launch, and nothing more until then.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 text-brand-teal mb-2">
          <Bell className="w-4 h-4" />
          <span className="text-sm font-medium">Notify me at launch</span>
        </div>
        <div className="h-9 rounded-lg border border-border bg-background px-3 flex items-center text-sm text-muted-foreground">
          you@example.com
        </div>
      </Frame>
    ),
  },
  {
    n: 4,
    title: "A preview for professionals",
    blurb:
      "Clinicians can preview the caregiver portal with sample data — the roster, tiers, and safety signals — before they ever enroll a patient.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 text-brand-navy mb-2">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">Portal preview</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Sample data only. No real patient information is shown.
        </p>
      </Frame>
    ),
  },
  {
    n: 5,
    title: "Secure links, no account needed",
    blurb:
      "Patients can review and sign consent, and confirm a session, from a private link sent to them — no password to create, and no barrier in a hard moment.",
    example: (
      <Frame>
        <div className="flex items-center gap-2 text-brand-teal mb-3">
          <PenLine className="w-4 h-4" />
          <span className="text-sm font-medium">Consent &amp; confirmation</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-teal" />
            <span className="text-foreground">Consent reviewed and signed</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Session confirmed</span>
          </div>
        </div>
      </Frame>
    ),
  },
];

function AudienceHeader({
  accent,
  eyebrow,
  title,
  intro,
}: {
  accent: Accent;
  eyebrow: string;
  title: string;
  intro: string;
}) {
  const dot = accent === "teal" ? "bg-brand-teal" : "bg-brand-navy";
  const text = accent === "teal" ? "text-brand-teal" : "text-brand-navy";
  return (
    <motion.div {...fade} className="max-w-2xl">
      <div className={`inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] ${text} mb-4`}>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {eyebrow}
      </div>
      <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-4">{title}</h2>
      <p className="text-muted-foreground leading-relaxed">{intro}</p>
    </motion.div>
  );
}

// The full, high-fidelity capability showcase — both audiences, every feature
// illustrated. Exported so the interactive sandbox tour can present the same
// comprehensive highlight reel before inviting people into the hands-on walk.
export function CapabilityShowcase() {
  return (
    <>
      {/* Public — before you sign in */}
      <section className="pt-8">
        <AudienceHeader
          accent="teal"
          eyebrow="Before you sign in"
          title="Ways to explore, openly"
          intro="You can learn how MeaningBridge works, see the plans, and even sign consent or confirm a session, all without an account."
        />
        <div className="mt-4">
          {publicWays.map((f, i) => (
            <FeatureRow
              key={f.n}
              n={f.n}
              title={f.title}
              blurb={f.blurb}
              accent={i % 2 === 0 ? "teal" : "navy"}
            >
              {f.example}
            </FeatureRow>
          ))}
        </div>
      </section>

      {/* Grieving */}
      <section className="pt-24">
        <AudienceHeader
          accent="teal"
          eyebrow="For those grieving"
          title="A companion for the space between"
          intro="A warm, private place to remember, reflect, and be gently accompanied — grounded in Dr. Robert Neimeyer's meaning-focused approach to grief."
        />
        <div className="mt-4">
          {grieving.map((f) => (
            <FeatureRow key={f.n} n={f.n} title={f.title} blurb={f.blurb} accent="teal">
              {f.example}
            </FeatureRow>
          ))}
        </div>
      </section>

      {/* Professionals */}
      <section className="pt-24">
        <AudienceHeader
          accent="navy"
          eyebrow="For professionals"
          title="An adjunct to your care"
          intro="Enroll the people in your care, let them consent, and see meaningful engagement and safety signals — never their private words. Built on HIPAA-covered infrastructure."
        />
        <div className="mt-4">
          {professionals.map((f) => (
            <FeatureRow key={f.n} n={f.n} title={f.title} blurb={f.blurb} accent="navy">
              {f.example}
            </FeatureRow>
          ))}
        </div>
      </section>
    </>
  );
}

export default function DemoPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="shrink-0">
            <Logo variant="lockup" size={38} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-6 pb-24">
        {/* Hero */}
        <motion.section {...fade} className="py-16 md:py-24 text-center max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.25em] text-brand-teal mb-5">A guided tour</p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight text-foreground mb-5">
            Everything MeaningBridge offers, one feature at a time
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            A walk through the whole experience — for those grieving and for the professionals who
            support them. Each example below is an illustration of the real feature.
          </p>
        </motion.section>

        <CapabilityShowcase />

        {/* Closing */}
        <motion.section
          {...fade}
          className="mt-24 rounded-3xl border border-border bg-card p-10 md:p-14 text-center"
        >
          <h2 className="font-serif text-3xl text-foreground mb-4">A bridge between two worlds</h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
            Between sessions, and between the living and the remembered. When you are ready, step
            gently into the experience.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-brand-teal px-6 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              For those grieving <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/caregiver"
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              For professionals <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
