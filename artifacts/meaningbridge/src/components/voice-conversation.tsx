import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Languages,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { VoiceOrb, type OrbState } from "./voice-orb";
import { useSpeechRecognition } from "../hooks/use-speech-recognition";

const base = import.meta.env.BASE_URL;

function languageLabel(lang: string): string {
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "language" });
    return dn.of(lang.split("-")[0]) ?? lang;
  } catch {
    return lang;
  }
}

// Split streamed text into speakable sentences so the companion can begin
// speaking before the whole reply has arrived.
function nextSentenceBoundary(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === "." || c === "!" || c === "?" || c === "\n") {
      // include trailing quotes/spaces
      let j = i + 1;
      while (j < text.length && /["'”’)\s]/.test(text[j])) j++;
      return j;
    }
  }
  return -1;
}

export function VoiceConversation({
  sessionId,
  onClose,
  greeting,
}: {
  sessionId: string;
  onClose: () => void;
  greeting?: string;
}) {
  const ttsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [started, setStarted] = useState(false);
  const [convState, setConvState] = useState<OrbState>("idle");
  const [interim, setInterim] = useState("");
  const [lastUser, setLastUser] = useState("");
  const [reply, setReply] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [voiceOn, setVoiceOn] = useState(
    () =>
      typeof window === "undefined" ||
      window.localStorage.getItem("mb-voice-output") !== "off",
  );
  const [textInput, setTextInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem("mb-voice-name")) || "",
  );
  const [voiceLang, setVoiceLang] = useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem("mb-voice-lang")) || "",
  );

  const convStateRef = useRef(convState);
  convStateRef.current = convState;
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const voiceNameRef = useRef(voiceName);
  voiceNameRef.current = voiceName;
  const voiceLangRef = useRef(voiceLang);
  voiceLangRef.current = voiceLang;

  // Audio metering
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Turn-taking
  const utteranceRef = useRef(""); // accumulated final speech this turn
  const lastActivityRef = useRef(0);
  const listenStartRef = useRef(0); // when the current listening turn began
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Streaming + TTS
  const abortRef = useRef<AbortController | null>(null);
  const replyRef = useRef("");
  const spokenUpToRef = useRef(0);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const streamDoneRef = useRef(false);

  // ---- voices ----
  useEffect(() => {
    if (!ttsSupported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [ttsSupported]);

  const pickUtterance = useCallback((text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.pitch = 1;
    const all = window.speechSynthesis.getVoices();
    const chosen =
      (voiceNameRef.current && all.find((v) => v.name === voiceNameRef.current)) ||
      (voiceLangRef.current && all.find((v) => v.lang === voiceLangRef.current)) ||
      null;
    if (chosen) u.voice = chosen;
    u.lang = voiceLangRef.current || chosen?.lang || u.lang;
    return u;
  }, []);

  // ---- speech recognition ----
  const onResult = useCallback((r: { transcript: string; isFinal: boolean }) => {
    if (convStateRef.current !== "listening") return;
    // Drop a final that lands in the first instants of a listening turn: it is
    // almost always the tail of the companion's own voice echoing back, not the
    // person. Real speech produces its final only after they pause.
    if (r.isFinal && Date.now() - listenStartRef.current < 500) return;
    lastActivityRef.current = Date.now();
    if (r.isFinal) {
      utteranceRef.current = (utteranceRef.current + " " + r.transcript).trim();
      setInterim("");
    } else {
      setInterim(r.transcript);
    }
  }, []);

  const recognition = useSpeechRecognition({
    lang: voiceLang || undefined,
    onResult,
    onError: (e) => {
      if (e === "not-allowed" || e === "service-not-allowed") {
        setError(
          "Microphone access is blocked. Click the microphone icon in your browser's address bar, choose Allow, then tap the orb — or just type below.",
        );
      } else if (e === "audio-capture") {
        setError(
          "No microphone was found. Check that a mic is connected and not in use by another app — or type below.",
        );
      }
      // 'no-speech', 'aborted' and 'network' are transient; the recognizer
      // restarts itself, so we stay quiet and keep listening.
    },
  });

  // ---- orb level loop ----
  // Deliberately synthetic: we do NOT open our own getUserMedia stream here.
  // Chrome's SpeechRecognition and a concurrent getUserMedia/AudioContext
  // compete for the microphone, and that competition can leave the recognizer
  // receiving silence — i.e. "it can't hear me". The orb still feels alive from
  // these state-driven pulses plus a bump whenever fresh speech is recognised.
  const startMeter = useCallback(() => {
    if (rafRef.current) return;
    const tick = () => {
      const s = convStateRef.current;
      if (s === "listening") {
        const fresh = Date.now() - lastActivityRef.current < 450;
        const shimmer = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(Date.now() / 240));
        setLevel(fresh ? Math.min(1, shimmer + 0.5) : shimmer);
      } else if (s === "speaking") {
        setLevel(0.35 + 0.25 * (0.5 + 0.5 * Math.sin(Date.now() / 180)));
      } else if (s === "thinking") {
        setLevel(0.2 + 0.1 * (0.5 + 0.5 * Math.sin(Date.now() / 300)));
      } else {
        setLevel((l) => l * 0.9);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ---- send a turn ----
  const speakNext = useCallback(() => {
    if (!ttsSupported || !voiceOnRef.current) return;
    if (ttsSpeakingRef.current) return;
    const chunk = ttsQueueRef.current.shift();
    if (!chunk) {
      // nothing queued
      if (streamDoneRef.current) resumeListening();
      return;
    }
    ttsSpeakingRef.current = true;
    const u = pickUtterance(chunk);
    u.onend = () => {
      ttsSpeakingRef.current = false;
      speakNext();
    };
    u.onerror = () => {
      ttsSpeakingRef.current = false;
      speakNext();
    };
    try {
      window.speechSynthesis.speak(u);
    } catch {
      ttsSpeakingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickUtterance, ttsSupported]);

  const enqueueSpeakable = useCallback(() => {
    if (!voiceOnRef.current) return;
    const full = replyRef.current;
    let idx = spokenUpToRef.current;
    while (true) {
      const b = nextSentenceBoundary(full, idx);
      if (b === -1) break;
      const sentence = full.slice(idx, b).trim();
      if (sentence) ttsQueueRef.current.push(sentence);
      idx = b;
    }
    spokenUpToRef.current = idx;
    speakNext();
  }, [speakNext]);

  const resumeListening = useCallback(() => {
    setReply("");
    replyRef.current = "";
    spokenUpToRef.current = 0;
    utteranceRef.current = "";
    setInterim("");
    setConvState("listening");
    const now = Date.now();
    lastActivityRef.current = now;
    listenStartRef.current = now;
    // The recognizer is kept alive for the whole session; start() is a no-op if
    // it is already running, and revives it if Chrome quietly dropped it.
    if (recognition.supported) recognition.start();
  }, [recognition]);

  const sendTurn = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text) return;
      // Note: we intentionally do NOT stop the recognizer here. It stays alive
      // for the whole session (started once, on the opening tap) which is far
      // more reliable than stop/restart; results are simply ignored while the
      // state is "thinking"/"speaking".
      setLastUser(text);
      setInterim("");
      setReply("");
      replyRef.current = "";
      spokenUpToRef.current = 0;
      ttsQueueRef.current = [];
      streamDoneRef.current = false;
      setCrisis(false);
      setConvState("thinking");
      if (ttsSupported) window.speechSynthesis.cancel();

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`${base}api/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ content: text }),
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        const handleLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === "delta" && d.text) {
              if (convStateRef.current !== "speaking") setConvState("speaking");
              replyRef.current += d.text;
              setReply(replyRef.current);
              enqueueSpeakable();
            } else if (d.type === "crisis") {
              setCrisis(true);
            } else if (d.type === "error") {
              setError("The companion had trouble responding. Please try again.");
            }
          } catch {
            /* skip partial */
          }
        };
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";
          for (const l of lines) handleLine(l);
        }
        sseBuffer += decoder.decode();
        if (sseBuffer) for (const l of sseBuffer.split("\n")) handleLine(l);

        streamDoneRef.current = true;
        enqueueSpeakable();
        // If nothing to speak (voice off, or empty), go straight back to listening.
        if (!voiceOnRef.current || ttsQueueRef.current.length === 0) {
          if (!ttsSpeakingRef.current) resumeListening();
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setError("Could not reach the companion. Please try again.");
          setConvState("listening");
          if (recognition.supported) recognition.start();
        }
      }
    },
    [sessionId, ttsSupported, enqueueSpeakable, resumeListening, recognition],
  );

  // silence detector — end the user's turn after a pause
  useEffect(() => {
    silenceTimerRef.current = setInterval(() => {
      if (convStateRef.current !== "listening") return;
      const pending = (utteranceRef.current + " " + interim).trim();
      if (pending && Date.now() - lastActivityRef.current > 1300) {
        sendTurn(utteranceRef.current || interim);
      }
    }, 300);
    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, [interim, sendTurn]);

  // ---- start / stop ----
  const begin = useCallback(() => {
    setStarted(true);
    setError(null);
    startMeter();
    // Start the microphone right away, on this tap, so the browser shows its
    // permission prompt and the recognizer is live from the first moment.
    if (recognition.supported) recognition.start();
    if (greeting && voiceOnRef.current && ttsSupported) {
      // Speak a short opening, then listen. Because Chrome's utterance "end"
      // event is unreliable and sometimes never fires, we also arm a fallback
      // timer so the mic is never left stranded in the "speaking" state.
      setConvState("speaking");
      streamDoneRef.current = true;
      replyRef.current = greeting;
      setReply(greeting);
      utteranceRef.current = "";
      ttsQueueRef.current = [greeting];
      speakNext();
      const words = greeting.trim().split(/\s+/).length;
      const estMs = Math.min(11000, 2200 + words * 360);
      window.setTimeout(() => {
        if (convStateRef.current === "speaking") resumeListening();
      }, estMs);
    } else {
      // Show the greeting as text and start listening immediately.
      if (greeting) {
        replyRef.current = greeting;
        setReply(greeting);
      }
      resumeListening();
    }
  }, [greeting, startMeter, speakNext, resumeListening, ttsSupported, recognition]);

  // Open straight into a live conversation — no extra "start" tap. Opening the
  // panel is itself the user gesture, so the mic can come up right away.
  const autoBegunRef = useRef(false);
  useEffect(() => {
    if (autoBegunRef.current) return;
    autoBegunRef.current = true;
    begin();
  }, [begin]);

  const interrupt = useCallback(() => {
    // barge-in: stop talking / thinking and listen
    if (ttsSupported) window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    abortRef.current?.abort();
    resumeListening();
  }, [resumeListening, ttsSupported]);

  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    abortRef.current?.abort();
    if (ttsSupported) window.speechSynthesis.cancel();
    recognition.abort();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
  }, [recognition, ttsSupported]);

  useEffect(() => cleanup, [cleanup]);

  const toggleVoice = () => {
    setVoiceOn((on) => {
      const next = !on;
      if (typeof window !== "undefined")
        window.localStorage.setItem("mb-voice-output", next ? "on" : "off");
      if (!next && ttsSupported) {
        window.speechSynthesis.cancel();
        ttsQueueRef.current = [];
        ttsSpeakingRef.current = false;
      }
      return next;
    });
  };

  const persistVoice = (name: string, lang: string) => {
    setVoiceName(name);
    setVoiceLang(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mb-voice-name", name);
      window.localStorage.setItem("mb-voice-lang", lang);
    }
  };
  const voiceLangs = Array.from(new Set(voices.map((v) => v.lang))).sort();
  const activeLang = voiceLang || voices.find((v) => v.name === voiceName)?.lang || "";
  const voicesForLang = voices.filter((v) => v.lang === activeLang);

  const statusLabel =
    convState === "listening"
      ? "Listening"
      : convState === "thinking"
        ? "Thinking"
        : convState === "speaking"
          ? "Speaking"
          : "Ready";

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[hsl(215_45%_12%)] to-[hsl(215_50%_8%)] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <span
            className={`w-2 h-2 rounded-full ${
              convState === "listening"
                ? "bg-emerald-400 animate-pulse"
                : convState === "speaking"
                  ? "bg-sky-400"
                  : convState === "thinking"
                    ? "bg-amber-300"
                    : "bg-white/40"
            }`}
          />
          {statusLabel}
        </div>
        <div className="flex items-center gap-1">
          {ttsSupported && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="h-9 px-2 rounded-full flex items-center gap-1 text-white/70 hover:bg-white/10 transition-colors"
                aria-label="Voice and language"
                title="Voice and language"
              >
                <Languages className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>
              {pickerOpen && (
                <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-white/15 bg-[hsl(215_45%_14%)] shadow-xl p-4 space-y-3 text-white">
                  <p className="text-xs text-white/60">
                    Free voices from your device. Change anytime, or say
                    "speak in Spanish".
                  </p>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Language</span>
                    <select
                      value={activeLang}
                      onChange={(e) => {
                        const l = e.target.value;
                        const v = voices.find((x) => x.lang === l);
                        persistVoice(v?.name ?? "", l);
                      }}
                      className="w-full rounded-lg bg-white/10 border border-white/15 px-2 py-1.5 text-sm"
                    >
                      {voiceLangs.length === 0 && <option value="">Default</option>}
                      {voiceLangs.map((l) => (
                        <option key={l} value={l} className="text-black">
                          {languageLabel(l)} ({l})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Voice</span>
                    <select
                      value={voiceName}
                      onChange={(e) => {
                        const v = voices.find((x) => x.name === e.target.value);
                        persistVoice(e.target.value, v?.lang ?? voiceLang);
                      }}
                      className="w-full rounded-lg bg-white/10 border border-white/15 px-2 py-1.5 text-sm"
                    >
                      {voicesForLang.length === 0 && <option value="">Default</option>}
                      {voicesForLang.map((v) => (
                        <option key={v.name} value={v.name} className="text-black">
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors"
            aria-label="Close voice conversation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Orb + captions */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 text-center">
        <button
          type="button"
          onClick={() => {
            if (!started) {
              begin();
              return;
            }
            if (convState === "speaking" || convState === "thinking") interrupt();
          }}
          className="relative outline-none"
          aria-label={started ? "Tap to interrupt" : "Tap to begin"}
        >
          <VoiceOrb state={convState} level={level} size={260} />
        </button>

        {!started ? (
          <div className="space-y-4 max-w-md">
            <h2 className="font-serif text-2xl">Talk with your companion</h2>
            <p className="text-white/70 leading-relaxed">
              Tap the orb and simply speak. It listens, replies aloud, and waits
              with you. You can type instead at any time.
            </p>
            <button
              type="button"
              onClick={begin}
              className="inline-flex items-center gap-2 rounded-full bg-white text-[hsl(215_50%_16%)] px-6 py-3 font-medium hover:bg-white/90 transition-colors"
            >
              <Mic className="w-4 h-4" />
              Start talking
            </button>
          </div>
        ) : (
          <div className="min-h-[4rem] max-w-xl space-y-2">
            {interim && convState === "listening" && (
              <p className="text-white/60 italic">{interim}</p>
            )}
            {lastUser && convState !== "listening" && (
              <p className="text-white/45 text-sm">You: {lastUser}</p>
            )}
            {reply && (
              <p className="text-lg leading-relaxed text-white/95 font-serif">
                {reply}
              </p>
            )}
            {convState === "listening" && !interim && (
              <p className="text-white/40">I'm listening…</p>
            )}
          </div>
        )}

        {crisis && (
          <a
            href={`${base}crisis`}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-100 px-4 py-2 text-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            If you are in danger, open crisis support
          </a>
        )}
        {error && <p className="text-amber-200/90 text-sm max-w-md">{error}</p>}
        {!recognition.supported && started && (
          <p className="text-white/50 text-xs max-w-md">
            Your browser can't listen live here, but you can type below and the
            companion will still speak back.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="px-5 pb-6 pt-2 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = textInput.trim();
            if (!t) return;
            setTextInput("");
            if (!started) setStarted(true);
            sendTurn(t);
          }}
          className="max-w-2xl mx-auto flex items-end gap-2"
        >
          <button
            type="button"
            onClick={() => {
              if (recognition.listening) recognition.stop();
              else resumeListening();
            }}
            className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              recognition.listening
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/10 text-white/70 hover:bg-white/15"
            }`}
            aria-label={recognition.listening ? "Pause microphone" : "Resume microphone"}
            title={recognition.listening ? "Pause microphone" : "Resume microphone"}
          >
            {recognition.listening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type here…"
            className="flex-1 rounded-full bg-white/10 border border-white/15 px-4 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              voiceOn ? "bg-sky-500/20 text-sky-300" : "bg-white/10 text-white/60 hover:bg-white/15"
            }`}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Mute companion voice" : "Unmute companion voice"}
            title={voiceOn ? "Companion voice on" : "Companion voice off"}
          >
            {voiceOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="w-11 h-11 shrink-0 rounded-full bg-white text-[hsl(215_50%_16%)] flex items-center justify-center disabled:opacity-40 hover:bg-white/90 transition-colors"
            aria-label="Send"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="text-center text-[11px] text-white/35">
          A companion, not a person or a substitute for professional care.
        </p>
      </div>
    </div>
  );
}
