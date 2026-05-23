import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Heart, Copy, Check, Maximize2 } from "lucide-react";
import { QRCodeImage } from "@/components/qr-code";

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
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      <header className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <span className="font-serif font-medium tracking-tight text-lg">MeaningBridge</span>
        </div>
        <Link
          href="/notify"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Notify me
        </Link>
      </header>

      <main className="px-6 pb-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center pt-8 md:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Coming soon
            </p>
            <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight">
              MeaningBridge is coming to you.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-serif italic">
              Brought to you by Dr. Robert Neimeyer.
            </p>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              A warm, AI-assisted grief companion grounded in a meaning-oriented,
              continuing-bonds approach. A bridge between sessions. A bridge between worlds.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/notify"
                className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-md px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Notify me at launch
              </Link>
              <Link
                href="/present"
                className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm text-foreground hover:border-primary/50 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
                Present QR full screen
              </Link>
            </div>

            <p className="text-sm text-muted-foreground pt-6">
              For more information, please reach out to{" "}
              <a
                href="mailto:neimeyer@portlandinstitute.org"
                className="text-primary hover:underline"
              >
                neimeyer@portlandinstitute.org
              </a>
              .
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-5"
          >
            <div className="rounded-2xl bg-card border border-border p-6 md:p-8 shadow-sm">
              {notifyUrl ? (
                <QRCodeImage value={notifyUrl} size={320} />
              ) : (
                <div style={{ width: 320, height: 320 }} />
              )}
            </div>

            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Scan to get notified when MeaningBridge launches.
            </p>

            <div className="w-full max-w-sm space-y-2">
              <div className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2">
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
      </main>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        MeaningBridge augments therapists and human connection. It is not a substitute for
        professional care.
      </footer>
    </div>
  );
}
