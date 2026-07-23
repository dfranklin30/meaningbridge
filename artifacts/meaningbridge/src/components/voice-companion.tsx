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
import { unlockSpeech, startSpeechKeepAlive, stopSpeechKeepAlive } from "../lib/tts";

const base = import.meta.env.BASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// VoiceCompanion — a ChatGPT-style spoken conversation.
//
// Why this replaces the old VoiceConversation: the old one leaned on the
// browser's SpeechRecognition, which drops audio, fights the mic, and fails
// silently — "it can't hear me". This version instead RECORDS the person's
// voice (MediaRecorder) and sends the audio to the server's reliable Gemini
// transcription (POST /api/voice/transcribe → { text }). It then runs the same
// companion chat stream and speaks the reply back. The orb pulses with the
// person's REAL microphone amplitude, turn-taking is driven by voice-activity
// detection (it waits for a natural pause), tapping the orb interrupts, and the
// loop continues on its own.
// ─────────────────────────────────────────────────────────────────────────────

// VAD / turn-taking tuning
const START_RMS = 0.025; // above this we consider it speech
const SILENCE_MS = 1200; // pause after speech that ends a turn
const MIN_SPEECH_MS = 350; // ignore blips shorter than this
const MAX_TURN_MS = 30000; // hard cap on one spoken turn
const PRIMING_MS = 350; // ignore the first instants (avoids catching TTS tail)

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
      let j = i + 1;
      while (j < text.length && /["'”’)\s]/.test(text[j])) j++;
      return j;
    }
  }
  return -1;
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function VoiceCompanion({
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

  const [phase, setPhase] = useState<OrbState>("idle");
  const [level, setLevel] = useState(0);
  const [lastUser, setLastUser] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [voiceOn, setVoiceOn] = useState(
    () =>
      typeof window === "undefined" ||
      window.localStorage.getItem("mb-voice-output") !== "off",
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem("mb-voice-name")) || "",
  );
  const [voiceLang, setVoiceLang] = useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem("mb-voice-lang")) || "",
  );

  // live refs
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const voiceNameRef = useRef(voiceName);
  voiceNameRef.current = voiceName;
  const voiceLangRef = useRef(voiceLang);
  voiceLangRef.current = voiceLang;

  // audio graph
  const streamRef = useRef<MediaStream | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);

  // recorder + VAD
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("");
  const speechDetectedRef = useRef(false);
  const speechStartedAtRef = useRef(0);
  const lastLoudRef = useRef(0);
  const turnStartRef = useRef(0);
  const stoppingRef = useRef(false);

  // streaming + tts
  const abortRef = useRef<AbortController | null>(null);
  const replyRef = useRef("");
  const spokenUpToRef = useRef(0);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsSpeakingRef = useRef(false);
  const streamDoneRef = useRef(false);
  const teardownRef = useRef(false);

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

  // ---- forward decls via refs so callbacks can call each other ----
  const startListeningRef = useRef<() => void>(() => {});
  const sendTextTurnRef = useRef<(t: string) => void>(() => {});

  // ---- speak queue ----
  const speakNext = useCallback(() => {
    if (!ttsSupported || !voiceOnRef.current) return;
    if (ttsSpeakingRef.current) return;
    const chunk = ttsQueueRef.current.shift();
    if (!chunk) {
      stopSpeechKeepAlive();
      if (streamDoneRef.current && phaseRef.current === "speaking") {
        startListeningRef.current();
      }
      return;
    }
    ttsSpeakingRef.current = true;
    startSpeechKeepAlive();
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

  // ---- metering + VAD loop (single RAF) ----
  const ensureLoop = useCallback(() => {
    if (rafRef.current) return;
    const tick = () => {
      const analyser = analyserRef.current;
      const data = dataRef.current;
      let rms = 0;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        rms = Math.sqrt(sum / data.length);
      }
      const p = phaseRef.current;
      if (p === "listening") {
        setLevel(Math.min(1, rms * 4));
        const now = Date.now();
        const primed = now - turnStartRef.current > PRIMING_MS;
        if (primed && rms > START_RMS) {
          if (!speechDetectedRef.current) speechStartedAtRef.current = now;
          speechDetectedRef.current = true;
          lastLoudRef.current = now;
        }
        const heardEnough =
          speechDetectedRef.current &&
          now - speechStartedAtRef.current > MIN_SPEECH_MS;
        const silentLongEnough =
          speechDetectedRef.current && now - lastLoudRef.current > SILENCE_MS;
        const tooLong = now - turnStartRef.current > MAX_TURN_MS;
        if ((heardEnough && silentLongEnough) || (tooLong && speechDetectedRef.current)) {
          endTurn();
        }
      } else if (p === "speaking") {
        setLevel(0.32 + 0.24 * (0.5 + 0.5 * Math.sin(Date.now() / 170)));
      } else if (p === "thinking") {
        setLevel(0.18 + 0.1 * (0.5 + 0.5 * Math.sin(Date.now() / 300)));
      } else {
        setLevel((l) => l * 0.9);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- recording control ----
  const startListening = useCallback(() => {
    if (teardownRef.current) return;
    const stream = streamRef.current;
    setReply("");
    replyRef.current = "";
    spokenUpToRef.current = 0;
    setError(null);
    if (!stream) {
      // No mic — stay idle, the person can type.
      setPhase("idle");
      return;
    }
    speechDetectedRef.current = false;
    speechStartedAtRef.current = 0;
    lastLoudRef.current = 0;
    turnStartRef.current = Date.now();
    stoppingRef.current = false;
    chunksRef.current = [];
    setPhase("listening");
    try {
      const rec = new MediaRecorder(
        stream,
        mimeRef.current ? { mimeType: mimeRef.current } : undefined,
      );
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => handleRecordingStopped();
      rec.start();
    } catch {
      setError("Couldn't start recording. You can type below instead.");
      setPhase("idle");
    }
    ensureLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureLoop]);
  startListeningRef.current = startListening;

  const endTurn = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleRecordingStopped = useCallback(async () => {
    if (teardownRef.current) return;
    const spoke = speechDetectedRef.current;
    const blob = new Blob(chunksRef.current, {
      type: mimeRef.current || "audio/webm",
    });
    chunksRef.current = [];
    // Nothing meaningful captured — quietly listen again.
    if (!spoke || blob.size < 1200) {
      startListening();
      return;
    }
    setPhase("thinking");
    try {
      const fd = new FormData();
      const ext = (mimeRef.current || "audio/webm").includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `turn.${ext}`);
      const tr = await fetch(`${base}api/voice/transcribe`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!tr.ok) throw new Error(`transcribe ${tr.status}`);
      const { text } = (await tr.json()) as { text?: string };
      const said = (text || "").trim();
      if (!said) {
        // Couldn't make out words — try again without nagging.
        startListening();
        return;
      }
      sendTextTurnRef.current(said);
    } catch {
      setError("I didn't catch that clearly. Let's try again — go ahead.");
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  // ---- companion turn (text → streamed reply → speech) ----
  const sendTextTurn = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text) return;
      setLastUser(text);
      setReply("");
      replyRef.current = "";
      spokenUpToRef.current = 0;
      ttsQueueRef.current = [];
      streamDoneRef.current = false;
      setCrisis(false);
      setError(null);
      setPhase("thinking");
      if (ttsSupported) window.speechSynthesis.cancel();

      const controller = new AbortController();
      abortRef.current = controller;
      let gotToken = false;
      let timedOut = false;
      const watchdog = window.setTimeout(() => {
        if (!gotToken) {
          timedOut = true;
          try {
            controller.abort();
          } catch {
            /* ignore */
          }
        }
      }, 28000);

      try {
        const res = await fetch(`${base}api/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ content: text }),
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`bad response ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        const handleLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === "delta" && d.text) {
              gotToken = true;
              window.clearTimeout(watchdog);
              if (phaseRef.current !== "speaking") setPhase("speaking");
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
        if (!gotToken && !replyRef.current.trim()) {
          setError("The companion had trouble responding. Please try again.");
          startListening();
          return;
        }
        // Nothing to speak (voice off or empty) → straight back to listening.
        if (!voiceOnRef.current || ttsQueueRef.current.length === 0) {
          if (!ttsSpeakingRef.current) startListening();
        }
      } catch (err) {
        const name = (err as Error)?.name;
        if (timedOut) {
          setError("That took a moment too long — I'm still here. Try saying it again.");
          startListening();
        } else if (name !== "AbortError") {
          setError("Could not reach the companion. Please try again.");
          startListening();
        }
      } finally {
        window.clearTimeout(watchdog);
      }
    },
    [sessionId, ttsSupported, enqueueSpeakable, startListening],
  );
  sendTextTurnRef.current = sendTextTurn;

  // ---- start up: mic + greeting ----
  const begunRef = useRef(false);
  useEffect(() => {
    if (begunRef.current) return;
    begunRef.current = true;
    teardownRef.current = false;
    unlockSpeech();
    mimeRef.current = pickRecorderMime();

    const setup = async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (e) {
        const name = (e as Error)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError(
            "Microphone access is blocked. Allow the mic in your browser's address bar, then reopen — or just type below.",
          );
        } else {
          setError("No microphone was found. You can type below and I'll still speak back.");
        }
      }
      if (teardownRef.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (stream) {
        streamRef.current = stream;
        try {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ac = new AC();
          acRef.current = ac;
          const src = ac.createMediaStreamSource(stream);
          const analyser = ac.createAnalyser();
          analyser.fftSize = 2048;
          src.connect(analyser);
          analyserRef.current = analyser;
          dataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        } catch {
          /* metering optional */
        }
        setMicReady(true);
      }
      ensureLoop();

      // Greeting, then listen.
      if (greeting && voiceOnRef.current && ttsSupported) {
        setPhase("speaking");
        streamDoneRef.current = true;
        replyRef.current = greeting;
        setReply(greeting);
        ttsQueueRef.current = [greeting];
        speakNext();
        const words = greeting.trim().split(/\s+/).length;
        const estMs = Math.min(11000, 2200 + words * 360);
        window.setTimeout(() => {
          if (phaseRef.current === "speaking" && !ttsSpeakingRef.current) {
            startListening();
          } else if (phaseRef.current === "speaking") {
            // speech still going; the queue-drain will hand off to listening
          }
        }, estMs);
      } else {
        if (greeting) {
          replyRef.current = greeting;
          setReply(greeting);
        }
        startListening();
      }
    };
    setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- interrupt (barge-in via tapping the orb) ----
  const interrupt = useCallback(() => {
    stopSpeechKeepAlive();
    if (ttsSupported) window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    ttsSpeakingRef.current = false;
    abortRef.current?.abort();
    startListening();
  }, [ttsSupported, startListening]);

  // ---- cleanup ----
  useEffect(() => {
    return () => {
      teardownRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      abortRef.current?.abort();
      stopSpeechKeepAlive();
      if (ttsSupported) window.speechSynthesis.cancel();
      try {
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      acRef.current?.close().catch(() => {});
    };
  }, [ttsSupported]);

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
    phase === "listening"
      ? "Listening"
      : phase === "thinking"
        ? "Thinking"
        : phase === "speaking"
          ? "Speaking"
          : micReady
            ? "Ready"
            : "Starting…";

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[hsl(215_45%_12%)] to-[hsl(215_50%_8%)] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <span
            className={`w-2 h-2 rounded-full ${
              phase === "listening"
                ? "bg-emerald-400 animate-pulse"
                : phase === "speaking"
                  ? "bg-sky-400"
                  : phase === "thinking"
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
                    The reply voice comes from your device. Change it anytime.
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
            if (phase === "speaking" || phase === "thinking") interrupt();
          }}
          className="relative outline-none"
          aria-label="Tap to interrupt"
        >
          <VoiceOrb state={phase} level={level} size={260} />
        </button>

        <div className="min-h-[4rem] max-w-xl space-y-2">
          {lastUser && phase !== "listening" && (
            <p className="text-white/45 text-sm">You: {lastUser}</p>
          )}
          {reply && (
            <p className="text-lg leading-relaxed text-white/95 font-serif">{reply}</p>
          )}
          {phase === "listening" && (
            <p className="text-white/40">
              {speechDetectedRef.current ? "…" : "I'm listening — go ahead."}
            </p>
          )}
          {phase === "thinking" && !reply && (
            <p className="text-white/40">One moment…</p>
          )}
        </div>

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
      </div>

      {/* Controls */}
      <div className="px-5 pb-6 pt-2 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = textInput.trim();
            if (!t) return;
            setTextInput("");
            sendTextTurn(t);
          }}
          className="max-w-2xl mx-auto flex items-end gap-2"
        >
          <button
            type="button"
            onClick={() => {
              if (phase === "listening") {
                // pause listening
                stoppingRef.current = true;
                const rec = recorderRef.current;
                if (rec && rec.state !== "inactive") {
                  rec.onstop = () => {
                    chunksRef.current = [];
                  };
                  try {
                    rec.stop();
                  } catch {
                    /* ignore */
                  }
                }
                setPhase("idle");
              } else if (phase === "idle") {
                startListening();
              } else {
                interrupt();
              }
            }}
            className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              phase === "listening"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/10 text-white/70 hover:bg-white/15"
            }`}
            aria-label={phase === "listening" ? "Pause microphone" : "Resume microphone"}
            title={phase === "listening" ? "Pause microphone" : "Resume microphone"}
          >
            {phase === "listening" ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
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
