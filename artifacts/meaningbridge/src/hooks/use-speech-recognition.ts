import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API isn't in the standard DOM lib types; we treat the
// recognition object loosely. It is free, on-device-initiated, and real-time —
// no server round-trip — which is why we use it for the live companion instead
// of uploading audio for transcription.
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

export function useSpeechRecognition(opts: {
  lang?: string;
  onResult?: (r: SpeechResult) => void;
  onError?: (e: string) => void;
}) {
  const Ctor = getRecognitionCtor();
  const supported = Boolean(Ctor);
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const [listening, setListening] = useState(false);

  const cbRef = useRef(opts);
  cbRef.current = opts;

  const stop = useCallback(() => {
    wantRef.current = false;
    const r = recRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const abort = useCallback(() => {
    wantRef.current = false;
    const r = recRef.current;
    if (r) {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    if (wantRef.current && recRef.current) return; // already listening
    wantRef.current = true;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    if (cbRef.current.lang) rec.lang = cbRef.current.lang;

    rec.onresult = (ev: unknown) => {
      const e = ev as {
        resultIndex: number;
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal: boolean }
        >;
      };
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) final += text;
        else interim += text;
      }
      if (final) cbRef.current.onResult?.({ transcript: final, isFinal: true });
      if (interim) cbRef.current.onResult?.({ transcript: interim, isFinal: false });
    };

    rec.onerror = (ev: unknown) => {
      const err = (ev as { error?: string })?.error ?? "speech_error";
      if (err === "not-allowed" || err === "service-not-allowed") {
        wantRef.current = false;
      }
      cbRef.current.onError?.(err);
    };

    rec.onend = () => {
      setListening(false);
      // Chrome drops the session periodically; resurrect it if we still want to
      // be listening so the mic stays "ready" hands-free.
      if (wantRef.current) {
        try {
          rec.start();
          setListening(true);
        } catch {
          /* will retry on next tick */
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start can throw if called twice; ignore */
    }
  }, [Ctor]);

  useEffect(
    () => () => {
      wantRef.current = false;
      const r = recRef.current;
      if (r) {
        try {
          r.abort();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  return { supported, listening, start, stop, abort };
}
