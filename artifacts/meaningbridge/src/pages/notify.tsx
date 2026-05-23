import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Heart, Check } from "lucide-react";
import { useCreateNotifyOptIn } from "@workspace/api-client-react";

export default function NotifyPage() {
  const [email, setEmail] = useState("");
  const [roleInterest, setRoleInterest] = useState<"" | "seeker" | "therapist">("");
  const [submitted, setSubmitted] = useState(false);
  const [alreadyOnList, setAlreadyOnList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("qr");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src");
    if (src) setSource(src);
  }, []);

  const { mutateAsync, isPending } = useCreateNotifyOptIn();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    try {
      const result = await mutateAsync({
        data: {
          email: trimmed,
          roleInterest: roleInterest || null,
          source,
        },
      });
      setAlreadyOnList(Boolean(result.alreadySubscribed));
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again in a moment.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col font-sans text-foreground">
      <header className="px-6 py-6">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
            <Heart className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <span className="font-serif font-medium tracking-tight text-lg">MeaningBridge</span>
          </div>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl w-full space-y-10"
        >
          <div className="space-y-4 text-center">
            <h1 className="font-serif text-4xl md:text-5xl leading-tight tracking-tight">
              MeaningBridge is coming.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              A warm, AI-assisted companion for the bereaved, grounded in Dr. Robert Neimeyer's
              meaning-oriented, continuing-bonds approach to grief. Leave your email and we will
              let you know the day it opens its doors.
            </p>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="rounded-xl border border-border bg-card p-8 text-center space-y-3"
            >
              <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <p className="font-serif text-xl">
                {alreadyOnList ? "You are already on the list." : "Thank you."}
              </p>
              <p className="text-muted-foreground text-sm">
                We will write to you the moment MeaningBridge is ready.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-background border border-border rounded-md px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  I am a <span className="text-muted-foreground/70">(optional)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "seeker", label: "Someone grieving" },
                    { value: "therapist", label: "Therapist or clinician" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setRoleInterest((cur) =>
                          cur === opt.value ? "" : (opt.value as "seeker" | "therapist"),
                        )
                      }
                      className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                        roleInterest === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-foreground hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-primary text-primary-foreground rounded-md py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Sending..." : "Notify me at launch"}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
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
      </main>
    </div>
  );
}
