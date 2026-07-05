import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessageCircle, X, Send, AlertTriangle, Loader2, ArrowRight } from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

type Persona = "concierge" | "seeker" | "provider";
type Turn = { role: "user" | "assistant"; content: string };

// The bubble is present on every screen. It is only suppressed until Clerk has
// resolved the session, so the persona (which depends on signed-in state) does
// not flicker on first paint.
const OPEN_KEY = "mb.bubble.open";

const PERSONA_COPY: Record<
  Persona,
  {
    title: string;
    intro: string;
    placeholder: string;
    deepLink: { href: string; label: string };
  }
> = {
  concierge: {
    title: "Ask about MeaningBridge",
    intro:
      "Hello. I can tell you how MeaningBridge works, who it is for, and how to begin. What would you like to know?",
    placeholder: "Ask a question...",
    deepLink: { href: "/sign-up", label: "Enter the full experience" },
  },
  seeker: {
    title: "A companion, here with you",
    intro:
      "Hello. I am here whenever you would like to talk. There is nothing you need to prepare — share whatever is present for you.",
    placeholder: "Write here...",
    deepLink: { href: "/companion", label: "Open the full companion" },
  },
  provider: {
    title: "Portal help",
    intro:
      "Hello. I can help you find your way around the portal and answer general questions about how it works. How can I help?",
    placeholder: "Ask about the portal...",
    deepLink: { href: "/care", label: "Go to the portal" },
  },
};

function resolvePersona(
  isSignedIn: boolean | undefined,
  isProfessional: boolean,
  location: string,
): Persona {
  if (!isSignedIn) return "concierge";
  // Provider help only for professionals inside the clinician portal — never for
  // a non-professional account that happens to hit a /care URL.
  if (
    isProfessional &&
    (location.startsWith("/care") || location.startsWith("/admin"))
  ) {
    return "provider";
  }
  return "seeker";
}

export function CompanionBubble() {
  const { isSignedIn, isLoaded } = useAuth();
  const [location] = useLocation();
  const { data: me } = useGetMe({
    query: { enabled: !!isSignedIn, queryKey: getGetMeQueryKey() },
  });

  // Restore the collapsed/expanded state across navigations and reloads.
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(OPEN_KEY) === "1";
  });
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [crisis, setCrisis] = useState(false);

  const sessionIdRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const persona = resolvePersona(isSignedIn, me?.isProfessional ?? false, location);
  const copy = PERSONA_COPY[persona];

  // Present on every screen; only wait for Clerk to resolve the session so the
  // persona does not flicker before we know whether someone is signed in.
  const hidden = !isLoaded;

  // Persist the collapsed/expanded state so it survives navigation and reloads.
  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  }, [open]);

  // Reset the conversation whenever the persona changes (e.g. switching spaces
  // or signing in/out) so a provider never sees a seeker transcript and vice
  // versa. Seeker transcripts are rehydrated from the server session.
  useEffect(() => {
    setMessages([]);
    setError(false);
    setCrisis(false);
    sessionIdRef.current = null;
    if (persona !== "seeker" || !me) return;

    const key = `mb.bubble.session.${me.id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const id = parseInt(stored, 10);
    if (!id) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/chat/sessions/${id}`, {
          credentials: "include",
        });
        if (!res.ok) {
          localStorage.removeItem(key);
          return;
        }
        const data = (await res.json()) as {
          messages?: { role: string; content: string }[];
        };
        if (cancelled) return;
        sessionIdRef.current = id;
        setMessages(
          (data.messages ?? []).map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        );
      } catch {
        // Best effort — a failed hydrate just starts an empty conversation.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persona, me]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, busy]);

  const appendDelta = (text: string) => {
    setMessages((prev) => {
      const copyArr = [...prev];
      const last = copyArr[copyArr.length - 1];
      if (last && last.role === "assistant") {
        copyArr[copyArr.length - 1] = {
          ...last,
          content: last.content + text,
        };
      }
      return copyArr;
    });
  };

  async function streamResponse(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error("stream_failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    // Frames are delimited by a blank line. Carry any partial frame between
    // reads so a `data:` line split across chunk boundaries is never dropped.
    let buffer = "";
    let sawError = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(line.indexOf(":") + 1).trim();
        if (!payload) continue;
        let evt: { type?: string; text?: string };
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        if (evt.type === "delta" && evt.text) appendDelta(evt.text);
        else if (evt.type === "crisis") setCrisis(true);
        else if (evt.type === "error") sawError = true;
      }
    }
    // Surface a server-sent error frame only after draining the stream, so it is
    // never swallowed by the per-frame JSON parse guard above.
    if (sawError) throw new Error("stream_error");
  }

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(false);
    setBusy(true);

    const history = [...messages, { role: "user" as const, content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      if (persona === "seeker") {
        let sid = sessionIdRef.current;
        if (!sid) {
          const created = await fetch(`${API}/chat/sessions`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "meaning", title: "Corner companion" }),
          });
          if (!created.ok) throw new Error("session_failed");
          const session = (await created.json()) as { id: number };
          sid = session.id;
          sessionIdRef.current = sid;
          if (me) {
            localStorage.setItem(`mb.bubble.session.${me.id}`, String(sid));
          }
        }
        await streamResponse(`${API}/chat/sessions/${sid}/messages`, {
          content: text,
        });
      } else {
        const endpoint =
          persona === "provider"
            ? `${API}/professional/general-assistant`
            : `${API}/concierge/message`;
        await streamResponse(endpoint, {
          messages: history.map(({ role, content }) => ({ role, content })),
        });
      }
    } catch {
      setError(true);
      // Drop the empty assistant placeholder on failure.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setBusy(false);
    }
  };

  if (hidden) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6 font-sans">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mb-3 w-[calc(100vw-2rem)] max-w-sm h-[70vh] max-h-[540px] flex flex-col rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card">
              <span className="font-serif text-sm text-foreground">
                {copy.title}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="rounded-2xl bg-background border border-border px-4 py-3 text-sm text-foreground leading-relaxed">
                  {copy.intro}
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border text-foreground"
                    }`}
                  >
                    {m.content || (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:200ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:400ms]" />
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {crisis && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-destructive/90 leading-relaxed mb-1">
                      If you are feeling overwhelmed, support is available right
                      now.
                    </p>
                    <Link
                      href="/crisis"
                      onClick={() => setOpen(false)}
                      className="text-xs font-medium text-destructive underline underline-offset-2"
                    >
                      View crisis resources
                    </Link>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground leading-relaxed">
                  Something interrupted the reply. Please try again when you are
                  ready.
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="px-4 pt-2 pb-1">
              <Link
                href={copy.deepLink.href}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {copy.deepLink.label}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-3 border-t border-border/60">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2 bg-background border border-border rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-primary/50 transition-shadow"
              >
                <textarea
                  className="flex-1 max-h-24 min-h-[40px] bg-transparent border-none resize-none focus:ring-0 px-2.5 py-2 text-sm"
                  placeholder={copy.placeholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || busy}
                  aria-label="Send"
                  className="w-9 h-9 shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 transition-opacity mb-0.5"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close companion" : "Open companion"}
        className={`ml-auto relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors ${
          open ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-white"
        }`}
      >
        {!open && <GuideOrb />}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              className="relative z-10"
              initial={{ opacity: 0, rotate: -30 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 30 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              className="relative z-10"
              initial={{ opacity: 0, rotate: -30 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 30 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle className="w-6 h-6 drop-shadow-sm" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

// The collapsed companion is an abstract, on-brand orb — the navy→teal
// infinity palette rendered as a gentle sphere. It breathes slowly to signal a
// quiet, waiting presence, and rests still for anyone who prefers reduced motion.
function GuideOrb() {
  const reduceMotion = useReducedMotion();
  return (
    <span className="absolute inset-0 rounded-full overflow-hidden">
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 30%, var(--brand-teal), var(--brand-navy) 78%)",
        }}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 68% 72%, rgba(255,255,255,0.4), transparent 55%)",
        }}
        animate={reduceMotion ? undefined : { opacity: [0.3, 0.6, 0.3], scale: [1, 1.08, 1] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 6, repeat: Infinity, ease: "easeInOut" }
        }
      />
    </span>
  );
}
