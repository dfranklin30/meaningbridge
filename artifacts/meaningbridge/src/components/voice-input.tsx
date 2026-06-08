import { useState, useEffect, useRef } from "react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react/audio";
import { Mic, Square, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Status = "idle" | "recording" | "transcribing" | "error";

type VoiceInputProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

export function VoiceInput({ onTranscript, disabled, className }: VoiceInputProps) {
  const recorder = useVoiceRecorder();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        void recorder.stopRecording().catch(() => {});
      }
    };
  }, [recorder]);

  const start = async () => {
    setMessage(null);
    try {
      await recorder.startRecording();
      recordingRef.current = true;
      setStatus("recording");
    } catch {
      setStatus("error");
      setMessage(
        "Microphone access is needed to record. You can allow it in your browser settings, or simply type instead.",
      );
    }
  };

  const stop = async () => {
    setStatus("transcribing");
    recordingRef.current = false;
    try {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size === 0) {
        setStatus("idle");
        return;
      }
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch(`${import.meta.env.BASE_URL}api/voice/transcribe`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("transcription failed");
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (text) onTranscript(text);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("That recording could not be transcribed. Please try again, or type instead.");
    }
  };

  const toggle = () => {
    if (status === "recording") {
      void stop();
    } else if (status === "idle" || status === "error") {
      void start();
    }
  };

  const label =
    status === "recording"
      ? "Stop recording"
      : status === "transcribing"
        ? "Transcribing"
        : "Record voice";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={status === "transcribing" || (Boolean(disabled) && status !== "recording")}
        aria-label={label}
        title={label}
        className={`relative w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
          status === "recording"
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        {status === "recording" && (
          <motion.span
            className="absolute inset-0 rounded-lg border border-destructive/40"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {status === "transcribing" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === "recording" ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      <AnimatePresence>
        {status === "transcribing" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground mt-2"
          >
            Listening back, one moment...
          </motion.p>
        )}
        {status === "error" && message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground mt-2 max-w-xs"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
