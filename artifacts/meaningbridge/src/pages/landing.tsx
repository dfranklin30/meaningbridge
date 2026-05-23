import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Copy, Check, Maximize2, ArrowRight } from "lucide-react";
import { QRCodeImage } from "@/components/qr-code";
import { Logo } from "@/components/logo";
import { BridgeAnimation } from "@/components/bridge-animation";
import { SceneGallery } from "@/components/scene-gallery";
import { LivingBackground } from "@/components/living-background";

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

      <header className="relative z-10 px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <Logo size={32} withWordmark />
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/notify" className="hover:text-foreground transition-colors">
            Notify me
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
          >
            Enter the experience
            <ArrowRight className="w-3.5 h-3.5" />
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
            <p className="text-lg text-muted-foreground leading-relaxed font-serif italic">
              Brought to you by Dr. Robert Neimeyer.
            </p>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              A warm, AI-assisted grief companion grounded in a meaning-oriented,
              continuing-bonds approach. A bridge between sessions. A bridge between worlds.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/notify"
                className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Notify me at launch
              </Link>
              <Link
                href="/app"
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
                  "A warm, unhurried presence trained in meaning-oriented, continuing-bonds care.",
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
                  "A place to keep a profile of who they were and what they meant.",
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
              href="/app"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
            >
              Enter the experience
              <ArrowRight className="w-4 h-4" />
            </Link>
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
