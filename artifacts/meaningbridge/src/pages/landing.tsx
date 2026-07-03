import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Copy, Check, Maximize2, ArrowRight } from "lucide-react";
import { QRCodeImage } from "@/components/qr-code";
import { Logo } from "@/components/logo";
import { BridgeAnimation } from "@/components/bridge-animation";
import { SceneGallery } from "@/components/scene-gallery";
import { LivingBackground } from "@/components/living-background";
import photoBonds from "@/assets/photo-bonds.png";
import neimeyerPortrait from "@assets/image_1782985313122.png";
import lectureCongress from "@assets/image_1782985283687.png";
import lectureAudience from "@assets/image_1782985270880.png";
import lectureGreen from "@assets/image_1782985276701.png";
import lectureTie from "@assets/image_1782985295812.png";
import lectureStanding from "@assets/image_1783094613403.png";

export default function LandingPage() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const notifyUrl = useMemo(() => (origin ? `${origin}/notify?src=qr` : ""), [origin]);

  const handleCopy = async () => {
    if (!notifyUrl) return;
    try {
      await navigator.clipboard.writeText(notifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-[100dvh] text-foreground font-sans relative overflow-hidden isolate">
      {/* Living, slowly-drifting aurora background */}
      <LivingBackground />

      <header className="relative z-10 px-6 py-6 max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Logo variant="lockup" size={48} />
        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
          {[
            { href: "/sign-up", label: "For those grieving" },
            { href: "/pricing", label: "Plans" },
            { href: "/caregiver", label: "For professionals" },
            { href: "/evaluate", label: "Share feedback" },
            { href: "/notify", label: "Notify me" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative inline-flex items-center px-3 py-2 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
            >
              {item.label}
              <span className="pointer-events-none absolute left-3 right-3 -bottom-0.5 h-px origin-left scale-x-0 bg-primary/60 transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
          <Link
            href="/sign-up"
            className="group ml-1 sm:ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90 transition-opacity"
          >
            Enter the experience
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </nav>
      </header>

      <main className="relative z-10 px-6 pb-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center pt-8 md:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
              Coming soon
            </p>
            <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight">
              MeaningBridge <span className="text-primary">is coming to you.</span>
            </h1>
            <div className="flex items-center gap-3">
              <img
                src={neimeyerPortrait}
                alt="Dr. Robert Neimeyer"
                className="w-12 h-12 rounded-full object-cover border border-border shadow-sm"
              />
              <p className="text-lg text-muted-foreground leading-relaxed font-serif italic">
                Brought to you by Dr. Robert Neimeyer.
              </p>
            </div>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              A warm, AI-assisted grief companion grounded in Dr. Robert Neimeyer's
              meaning-focused approach to grief and the continuing bonds philosophy.
              A bridge between sessions. A bridge between worlds.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/notify"
                className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Notify me at launch
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm text-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                Enter the experience
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/present"
                className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
                Present QR full screen
              </Link>
            </div>

            <div className="text-sm text-muted-foreground pt-6 space-y-2">
              <p>
                For more information, please reach out to{" "}
                <a
                  href="mailto:neimeyer@portlandinstitute.org"
                  className="text-primary hover:underline"
                >
                  neimeyer@portlandinstitute.org
                </a>
                .
              </p>
              <p>
                Learn more about Dr. Neimeyer's work at the{" "}
                <a
                  href="https://portlandinstitute.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Portland Institute for Loss and Transition
                </a>
                .
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-5"
          >
            <div className="rounded-3xl bg-card border border-border p-8 md:p-10 shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.18)]">
              {notifyUrl ? (
                <QRCodeImage value={notifyUrl} size={300} />
              ) : (
                <div style={{ width: 300, height: 300 }} />
              )}
            </div>

            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Scan to get notified when MeaningBridge launches.
            </p>

            <div className="w-full max-w-sm space-y-2">
              <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2">
                <span className="text-xs text-muted-foreground truncate flex-1">{notifyUrl}</span>
                <button
                  onClick={handleCopy}
                  className="text-xs text-foreground hover:text-primary inline-flex items-center gap-1 shrink-0"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bridge animation — humans connecting with humans and with AI */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto mt-24 md:mt-32"
        >
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
              A bridge between people.
            </h2>
            <p className="text-muted-foreground">
              MeaningBridge is a quiet presence between you, the people you love, and the
              clinicians who care for you. The human bond stays primary. The AI sits beside,
              never in front.
            </p>
          </div>

          <div className="rounded-3xl bg-card/70 backdrop-blur border border-border p-4 md:p-10 shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.15)]">
            <BridgeAnimation />
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4 max-w-xl mx-auto">
            For everyone navigating loss — patients, families, therapists, physicians, and
            chaplains. Designed to be calm enough for the hardest day and clear enough for the
            first visit.
          </p>
        </motion.section>

        {/* Scenes of love, loss, and transformation */}
        <section className="max-w-6xl mx-auto mt-24 md:mt-32">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
              Love · Loss · Transformation
            </p>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
              The shape of a continuing bond.
            </h2>
            <p className="text-muted-foreground">
              The people and animals we love stay with us, even as the relationship changes.
              MeaningBridge is built around that truth.
            </p>
          </div>
          <SceneGallery />
        </section>

        {/* What's inside */}
        <section className="max-w-6xl mx-auto mt-24 md:mt-32">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
              A gentle place to keep the bond.
            </h2>
            <p className="text-muted-foreground">
              MeaningBridge augments therapists and human connection. It never replaces them.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: "AI companion",
                body:
                  "A warm, unhurried presence rooted in a meaning-focused approach and the continuing bonds philosophy.",
              },
              {
                title: "Journal",
                body:
                  "Private writing with gentle prompts — at your own pace, never required.",
              },
              {
                title: "Practices",
                body:
                  "Self-guided meditations, rituals, and continuing-bonds exercises.",
              },
              {
                title: "Insights",
                body:
                  "A soft, non-clinical sense of how you are doing across time.",
              },
              {
                title: "Loved one",
                body:
                  "A place to keep a profile of who they were and what they still mean.",
              },
              {
                title: "Crisis support",
                body:
                  "Always one tap away. We will never replace human help, and we will surface it when needed.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl bg-card/80 backdrop-blur border border-border p-6 hover:border-primary/40 transition-colors"
              >
                <h3 className="font-serif text-lg text-foreground">{card.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90 transition-opacity"
            >
              Enter the experience
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        {/* Evaluation invitation */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl mx-auto mt-24 md:mt-32"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-card p-8 md:p-14 shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.15)]">
            <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-8 md:gap-12 items-center">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
                  Your impressions matter
                </p>
                <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
                  Tell us how this felt.
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  MeaningBridge is still taking shape. If you have looked around
                  — as someone grieving, a clinician, or a thoughtful visitor —
                  a few minutes of honest reflection helps us build something
                  worthy of the people it is meant to hold.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/evaluate"
                    className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90 transition-opacity"
                  >
                    Share your reflection
                    <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    A few short sliders. No account needed.
                  </span>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.2)]">
                  <img
                    src={photoBonds}
                    alt="Two people sitting close together in soft window light, one resting gently on the other's shoulder."
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* About Dr. Neimeyer */}
        <section className="max-w-6xl mx-auto mt-24 md:mt-32">
          <div className="rounded-3xl bg-card/70 backdrop-blur border border-border p-8 md:p-12 shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.15)]">
            <div className="grid md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-center">
              <img
                src={neimeyerPortrait}
                alt="Dr. Robert Neimeyer"
                className="w-40 h-40 md:w-48 md:h-48 rounded-2xl object-cover mx-auto shadow-md"
              />
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
                  The mind behind MeaningBridge
                </p>
                <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
                  Dr. Robert Neimeyer
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Dr. Robert Neimeyer is one of the world's foremost authorities on grief and
                  bereavement. MeaningBridge is grounded in his meaning-focused approach to grief
                  and the continuing bonds philosophy he has helped shape — bringing decades of
                  clinical scholarship into a warm, everyday companion.
                </p>
                <p className="text-sm text-muted-foreground">
                  Learn more at the{" "}
                  <a
                    href="https://portlandinstitute.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Portland Institute for Loss and Transition
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-10">
              {[lectureStanding, lectureCongress, lectureAudience, lectureGreen, lectureTie].map(
                (src, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] rounded-xl overflow-hidden border border-border bg-secondary/30"
                  >
                    <img
                      src={src}
                      alt="Dr. Robert Neimeyer speaking"
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        MeaningBridge augments therapists and human connection. It is not a substitute for
        professional care.
      </footer>
    </div>
  );
}
