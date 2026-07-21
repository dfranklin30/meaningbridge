import { useCallback, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpeechRecognition } from "../hooks/use-speech-recognition";

type VoiceInputProps = {
  // Called with each completed phrase (appended to the composer).
  onTranscript: (text: string) => void;
  // Called continuously with the in-progress words, so the caller can show a
  // live preview if it wishes. Cleared (empty string) when a phrase finalises.
  onPartial?: (text: string) => void;
  disabled?: boolean;
  className?: string;
  lang?: string;
};

/**
 * Live voice typing. Uses the browser's on-device speech recognition so words
 * appear the instant they are spoken — no record-then-upload round trip, and no
 * server dependency. A floating caption shows the live transcript so the person
 * can see immediately that their voice is being heard.
 */
export function VoiceInput({
  onTranscript,
  onPartial,
  disabled,
  className,
  lang,
}: VoiceInputProps) {
  const [live, setLive] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const liveRef = useRef("");

  const handleResult = useCallback(
    (r: { transcript: string; isFinal: boolean }) => {
      if (r.isFinal) {
        const t = r.transcript.trim();
        if (t) onTranscript(t);
        setLive("");
        liveRef.current = "";
        onPartial?.("");
      } else {
        setLive(r.transcript);
        liveRef.current = r.transcript;
        onPartial?.(r.transcript);
      }
    },
    [onTranscript, onPartial],
  );

  const recognition = useSpeechRecognition({
    lang,
    onResult: handleResult,
    onError: (e) => {
      if (e === "not-allowed" || e === "service-not-allowed") {
        setMessage(
          "Microphone access is blocked. Click the mic icon in your browser's address bar and allow it, or type instead.",
        );
      } else if (e === "audio-capture") {
        setMessage(
          "No microphone was found. Check that a mic is connected, or type instead.",
        );
      }
      // 'no-speech' / 'aborted' / 'network' are transient and self-recover.
    },
  });

  const listening = recognition.listening;

  const toggle = () => {
    setMessage(null);
    if (listening) {
      // Flush whatever is still in-progress so nothing spoken is lost.
      const t = liveRef.current.trim();
      if (t) onTranscript(t);
      setLive("");
      liveRef.current = "";
      onPartial?.("");
      recognition.stop();
    } else {
      if (!recognition.supported) {
        setMessage(
          "Live voice typing is not supported in this browser. Please type, or try Chrome or Edge.",
        );
        return;
      }
      setLive("");
      liveRef.current = "";
      recognition.start();
    }
  };

  const label = listening ? "Stop voice typing" : "Voice typing";

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={Boolean(disabled) && !listening}
        aria-label={label}
        title={label}
        className={`relative w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
          listening
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        {listening && (
          <motion.span
            className="absolute inset-0 rounded-lg border border-destructive/40"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {listening ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-0 mb-2 z-20 w-64 max-w-[70vw] rounded-xl border border-border bg-card px-3 py-2 shadow-lg"
          >
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-destructive mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              Listening
            </div>
            <p className="text-sm text-foreground leading-snug min-h-[1.25rem]">
              {live || (
                <span className="text-muted-foreground">Start speaking…</span>
              )}
            </p>
          </motion.div>
        )}
        {message && !listening && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-0 mb-2 z-20 w-64 max-w-[70vw] rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
