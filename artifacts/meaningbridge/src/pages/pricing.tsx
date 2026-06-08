import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

interface Plan {
  key: "companion" | "enhanced" | "specialist";
  tierLabel: string;
  name: string;
  price: string;
  cadence: string;
  forWhom: string;
  pitch: string;
  features: string[];
  cta: string;
  ctaHref: string;
  accent: boolean;
  footnote?: string;
}

const PLANS: Plan[] = [
  {
    key: "companion",
    tierLabel: "Grief Literacy",
    name: "Companion",
    price: "Free",
    cadence: "for the first 90 days",
    forWhom: "For everyone living with grief.",
    pitch:
      "Most people do not need treatment. They need a quiet, attentive presence — and time.",
    features: [
      "AI companion grounded in continuing bonds",
      "Private journal with gentle prompts",
      "Self-guided practices and rituals",
      "Personal insights and check-ins",
      "Crisis resources always one tap away",
    ],
    cta: "Begin",
    ctaHref: "/sign-up",
    accent: false,
  },
  {
    key: "enhanced",
    tierLabel: "Enhanced Support",
    name: "Enhanced",
    price: "$24",
    cadence: "per month",
    forWhom: "For grief that asks for steadier company.",
    pitch:
      "Closer monitoring, structured check-ins, and a warm hand toward human support when you want it.",
    features: [
      "Everything in Companion",
      "Twice-monthly mutual-help groups",
      "Weekly check-ins with a grief educator",
      "Priority matching when you want a therapist",
      "Personalised practice plan",
    ],
    cta: "Begin",
    ctaHref: "/sign-up",
    accent: true,
  },
  {
    key: "specialist",
    tierLabel: "Specialist Support",
    name: "Specialist",
    price: "$89",
    cadence: "per month",
    forWhom: "For grief that deserves the support of a trained human.",
    pitch:
      "A licensed grief therapist matched to you, with the companion holding the space between sessions.",
    features: [
      "Everything in Enhanced",
      "A licensed grief therapist matched to you",
      "Weekly 50-minute video sessions",
      "Between-session messaging with your therapist",
      "Care coordination across your support team",
      "Consent-gated safety monitoring shared with your therapist",
    ],
    cta: "Speak with us",
    ctaHref: "/notify?src=pricing-specialist",
    accent: false,
    footnote: "Often eligible for FSA / HSA. Sliding-scale options available.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
              <Logo variant="lockup" size={40} />
            </div>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/caregiver" className="hover:text-foreground transition-colors">
              For professionals
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-1.5 rounded-md border border-border hover:border-foreground transition-colors"
            >
              Begin
            </Link>
          </nav>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-16 md:py-24 space-y-20">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center space-y-5 max-w-2xl mx-auto"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Preview — pricing and features shown for illustration
          </p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">
            Find the right level of support.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            MeaningBridge meets you where you are. A brief, validated screener at sign-up
            quietly points you toward the plan most likely to help — never as a verdict, always
            as an invitation.
          </p>
        </motion.section>

        <section className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.08 }}
              className={`flex flex-col rounded-2xl border p-7 ${
                plan.accent
                  ? "border-primary/40 bg-primary/[0.03] shadow-[0_1px_40px_-12px_hsl(var(--primary)/0.25)]"
                  : "border-border bg-card"
              }`}
            >
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  {plan.tierLabel}
                </p>
                <h3 className="text-2xl font-serif">{plan.name}</h3>
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-3xl font-serif">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.cadence}</span>
              </div>

              <p className="mt-5 text-sm text-foreground/90 leading-relaxed">{plan.forWhom}</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed italic">
                {plan.pitch}
              </p>

              <ul className="mt-7 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm leading-relaxed">
                    <Check className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`mt-8 inline-flex items-center justify-center gap-2 py-3 rounded-md text-sm font-medium transition-colors ${
                  plan.accent
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border hover:border-foreground"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              {plan.footnote && (
                <p className="mt-3 text-xs text-muted-foreground text-center">{plan.footnote}</p>
              )}
            </motion.div>
          ))}
        </section>

        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto text-center space-y-5 border-t border-border pt-16"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            How we think about this
          </p>
          <p className="text-base text-muted-foreground leading-relaxed">
            About six in ten people who lose someone they love need understanding, not treatment.
            About three in ten benefit from a little more company. About one in ten are carrying
            something a trained human should help them through. Your plan should follow your
            need — and change as your need changes. You can move up or down at any time, with no
            friction.
          </p>
          <p className="text-xs text-muted-foreground italic">
            Population estimates from Aoun et al. and the IWG Grief Therapy Workgroup (2025).
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-2xl border border-border bg-card p-10 md:p-14 text-center space-y-5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            For grief therapists and counselors
          </p>
          <h2 className="text-2xl md:text-3xl font-serif">
            MeaningBridge extends your care between sessions.
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            With the person&apos;s logged consent, see how the people in your care are doing, read brief
            session summaries before you meet, and step in when a safety signal asks for you.
            You stay in the lead.
          </p>
          <Link
            href="/caregiver"
            className="inline-flex items-center gap-2 text-sm text-foreground border-b border-foreground/30 hover:border-foreground pb-0.5 transition-colors"
          >
            Preview the professional portal
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.section>
      </main>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground space-y-1">
        <p>
          Preview — plans, pricing, and features are placeholders for design review. Payments
          and booking are not yet live.
        </p>
        <p>MeaningBridge — Brought to you by Dr. Robert Neimeyer</p>
        <p>
          <a
            href="https://portlandinstitute.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Portland Institute for Loss and Transition
          </a>
        </p>
      </footer>
    </div>
  );
}
