import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, ArrowRight } from "lucide-react";
import { useShareDeck } from "@workspace/api-client-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DeckShare() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useShareDeck();

  const pdfHref = `${import.meta.env.BASE_URL}meaningbridge-deck.pdf`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    try {
      await mutateAsync({
        data: { email: trimmed, firstName: firstName.trim() || null },
      });
      setSent(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again in a moment.");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-5xl mx-auto mt-24 md:mt-32"
    >
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-card p-8 md:p-14 shadow-[0_20px_60px_-20px_hsl(215_50%_30%/0.15)]">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative grid md:grid-cols-[1.1fr_1fr] gap-8 md:gap-12 items-center">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.25em] text-primary/80">
              A short overview
            </p>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
              Take the deck with you.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A ten-page overview of MeaningBridge — the philosophy, the
              companions, and the care behind it. Download it, or send it to
              someone who might find it steadying.
            </p>
            <a
              href={pdfHref}
              download="MeaningBridge-Overview.pdf"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90 transition-opacity"
            >
              <Download className="w-5 h-5" />
              Download the overview
            </a>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl border border-border bg-card p-8 text-center space-y-3"
            >
              <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <p className="font-serif text-xl">On its way.</p>
              <p className="text-muted-foreground text-sm">
                The overview is heading to that inbox now.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setFirstName("");
                }}
                className="text-sm text-primary hover:underline"
              >
                Send it to someone else
              </button>
            </motion.div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-2xl border border-border bg-card p-6 md:p-8"
            >
              <p className="text-sm text-muted-foreground">
                Or email the overview to yourself or someone else.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="deck-firstName"
                  className="text-sm font-medium text-muted-foreground"
                >
                  First name{" "}
                  <span className="text-muted-foreground/70">(optional)</span>
                </label>
                <input
                  id="deck-firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Who is this for?"
                  className="w-full bg-background border border-border rounded-md px-4 py-3"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="deck-email"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="deck-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-background border border-border rounded-md px-4 py-3"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="group w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Sending..." : "Email the overview"}
                {!isPending && (
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </motion.section>
  );
}
