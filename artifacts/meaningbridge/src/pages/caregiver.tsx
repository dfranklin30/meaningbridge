import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Show, useAuth, useClerk } from "@clerk/react";
import { useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  MessageSquare,
  CalendarClock,
  Activity,
  LogOut,
  HeartHandshake,
  ClipboardList,
  MailCheck,
  UserCheck,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { DemoPatientCard } from "@/pages/care/demo-sample";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function CaregiverAccountNav() {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const updateMe = useUpdateMe();

  const switchToGrieving = () => {
    if (updateMe.isPending) return;
    updateMe.mutate(
      { data: { role: "seeker" } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMeQueryKey(), updated);
          setLocation("/app");
        },
      },
    );
  };

  return (
    <>
      <Show when="signed-out">
        <Link href="/pricing" className="hover:text-foreground transition-colors">
          Plans
        </Link>
        <Link
          href="/notify?src=caregiver-preview"
          className="px-4 py-1.5 rounded-md border border-border hover:border-foreground transition-colors"
        >
          Join the professional waitlist
        </Link>
      </Show>
      <Show when="signed-in">
        <Link
          href="/care/account"
          className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Open your portal
        </Link>
        <Link href="/pricing" className="hover:text-foreground transition-colors">
          Plans
        </Link>
        <button
          type="button"
          onClick={switchToGrieving}
          disabled={updateMe.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-border hover:border-foreground transition-colors disabled:opacity-60"
        >
          <HeartHandshake className="w-3.5 h-3.5" />
          {updateMe.isPending ? "Switching..." : "Grieving experience"}
        </button>
        {updateMe.isError && (
          <span className="text-xs text-destructive">Could not switch. Please try again.</span>
        )}
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-border hover:border-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </Show>
    </>
  );
}

/**
 * Public marketing page for the professional (clinician) portal. It explains how
 * enrollment, consent, and the between-session read work, and offers an explicit,
 * clearly-labeled fictional sample. No real patient data is ever shown here; the
 * live roster lives behind verification at /care/patients.
 */
export default function Caregiver() {
  const [showSample, setShowSample] = useState(false);
  const { isSignedIn } = useAuth();

  // The How-it-works cards are real entry points. Signed-in clinicians go
  // straight into the step (each destination handles its own verification / 2FA
  // gate); signed-out visitors are routed to the professional waitlist. The
  // consent stage is always a no-token preview of what the patient receives.
  const enroll = isSignedIn
    ? { href: "/care/intake", action: "Start an intake" }
    : { href: "/notify?src=caregiver-enroll", action: "Join to enroll patients" };
  const roster = isSignedIn
    ? { href: "/care/patients", action: "Open your roster" }
    : { href: "/notify?src=caregiver-roster", action: "Join to see your roster" };

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
            <CaregiverAccountNav />
          </nav>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-12 md:py-16 space-y-16">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-5 max-w-3xl"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            For clinicians
          </p>
          <h1 className="text-3xl md:text-5xl font-serif leading-tight">
            Hold the space between sessions.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            MeaningBridge gives the people in your care a gentle companion for grief between
            appointments. You enroll them, they consent by email, and you see engagement — never the
            words they write. It is an adjunct to your care, not a replacement for it.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Show when="signed-in">
              <Link href="/care/patients" className="btn-primary inline-flex items-center gap-2">
                Go to your patients <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Show>
            <Show when="signed-out">
              <Link
                href="/notify?src=caregiver-preview"
                className="btn-primary inline-flex items-center gap-2"
              >
                Join the professional waitlist <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Show>
            <button
              type="button"
              onClick={() => setShowSample((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors"
            >
              {showSample ? "Hide the sample" : "See a sample patient"}
            </button>
          </div>
        </motion.section>

        {showSample && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              A fictional example
            </p>
            <DemoPatientCard />
          </motion.section>
        )}

        <section className="space-y-8">
          <h2 className="font-serif text-2xl">How it works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Step
              icon={ClipboardList}
              n="1"
              title="Enroll from a short intake"
              body="A guided form captures identity, the loss, clinical context, and goals. Your details are auto-filled from your verified account. Everything saves as an encrypted draft as you go."
              href={enroll.href}
              action={enroll.action}
            />
            <Step
              icon={MailCheck}
              n="2"
              title="Consent comes from the patient"
              body="On submit, the patient receives a secure link to review a plain-language consent and add their signature. Nothing activates until they sign — consent is the floor."
              href="/consent/preview"
              action="Preview the consent screen"
            />
            <Step
              icon={UserCheck}
              n="3"
              title="Activate and stay informed"
              body="Once consent is on file, you activate their space. Between sessions you see engagement and safety signals — a quiet, honest read that helps you step in when it matters."
              href={roster.href}
              action={roster.action}
            />
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-2xl border border-border bg-card p-10 md:p-12 grid md:grid-cols-3 gap-8"
        >
          <div className="md:col-span-1 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Why professionals join
            </p>
            <h3 className="text-xl font-serif leading-snug">
              MeaningBridge holds the space between sessions — so you can hold the space inside them.
            </h3>
          </div>
          <div className="md:col-span-2 grid sm:grid-cols-2 gap-6">
            <Pillar icon={Activity} title="Continuity of care">
              A read on how someone is doing since you last met — engagement and rhythm, never their
              private words.
            </Pillar>
            <Pillar icon={ShieldAlert} title="Safety, surfaced gently">
              Validated screeners flag what asks for a human, not what looks dramatic.
            </Pillar>
            <Pillar icon={CheckCircle2} title="Consent is the floor">
              Nothing activates, and nothing reaches you, without the patient&apos;s signed consent.
            </Pillar>
            <Pillar icon={CalendarClock} title="Light on your week">
              No new EHR to learn. A short intake, an emailed consent, a calm roster.
            </Pillar>
          </div>
        </motion.section>

        <section className="text-center pb-8 space-y-4">
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            MeaningBridge is an adjunct to professional care. It does not provide therapy or respond
            to emergencies.
          </p>
          <Show when="signed-out">
            <Link
              href="/notify?src=caregiver-preview"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Join the professional waitlist
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/care/patients"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Go to your patients
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Show>
        </section>
      </main>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground space-y-1">
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

function Step({
  icon: Icon,
  n,
  title,
  body,
  href,
  action,
}: {
  icon: typeof CheckCircle2;
  n: string;
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <Link href={href}>
      <div className="group h-full cursor-pointer rounded-xl border border-border bg-card p-6 space-y-3 transition-colors hover:border-foreground/40 hover:bg-secondary/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-primary">
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Step {n}</span>
        </div>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        <span className="inline-flex items-center gap-1.5 pt-1 text-sm text-primary transition-all group-hover:gap-2.5">
          {action} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Pillar({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CheckCircle2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary/70" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
