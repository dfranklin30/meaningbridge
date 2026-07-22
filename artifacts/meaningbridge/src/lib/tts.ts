// Robust, cross-platform text-to-speech built on the Web Speech API.
//
// Naive `speechSynthesis.speak()` fails in ways that differ by platform, which
// is why the companion's read-aloud felt broken — especially on phones. This
// module handles the real-world quirks so a spoken reply works the same on
// desktop and mobile:
//
//   * iOS / Safari refuses to speak unless the FIRST utterance happens inside a
//     real user gesture, and reports zero voices until then. We "unlock" on the
//     first tap and warm the voice list.
//   * iOS truncates long utterances, and desktop Chrome silently stops speaking
//     after ~15 seconds. We split replies into short sentence chunks and nudge
//     `resume()` on a timer so long replies play through to the end.
//   * Voices load asynchronously; getVoices() is often empty on first call.
//
// No audio data ever leaves the device — this is the browser's own synthesizer.

const hasTTS = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

let unlocked = false;

/**
 * Call this from within a user gesture (a tap/click) — sending a message,
 * tapping the orb, toggling voice, pressing a replay button. It primes the
 * synthesizer so later, gesture-less auto-reads are allowed on iOS.
 */
export function unlockSpeech(): void {
  if (unlocked || !hasTTS()) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
    // Warm the voice list too.
    window.speechSynthesis.getVoices();
    unlocked = true;
  } catch {
    /* ignore — best effort */
  }
}

/** Resolve the available voices, waiting for them to load if necessary. */
export function getVoicesAsync(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!hasTTS()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        window.speechSynthesis.removeEventListener("voiceschanged", finish);
      } catch {
        /* ignore */
      }
      resolve(window.speechSynthesis.getVoices());
    };
    try {
      window.speechSynthesis.addEventListener("voiceschanged", finish);
    } catch {
      /* ignore */
    }
    window.setTimeout(finish, timeoutMs);
  });
}

// Split into chunks that end on sentence boundaries and stay short enough to
// dodge iOS truncation.
function chunkText(text: string, max = 180): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?\n]+[.!?\n]*/g) ?? [clean];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && (buf + s).length > max) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
    // A single very long sentence still needs to be broken up.
    while (buf.length > max) {
      let cut = buf.lastIndexOf(" ", max);
      if (cut <= 0) cut = max;
      chunks.push(buf.slice(0, cut).trim());
      buf = buf.slice(cut);
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

let keepAlive: ReturnType<typeof setInterval> | null = null;

/** Nudge the synthesizer so it doesn't silently pause on long replies. */
export function startSpeechKeepAlive(): void {
  stopSpeechKeepAlive();
  if (!hasTTS()) return;
  keepAlive = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
    } else {
      stopSpeechKeepAlive();
    }
  }, 7000);
}

export function stopSpeechKeepAlive(): void {
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
}

export function cancelSpeech(): void {
  if (!hasTTS()) return;
  stopSpeechKeepAlive();
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function isSpeaking(): boolean {
  return hasTTS() && window.speechSynthesis.speaking;
}

export interface SpeakOptions {
  voiceName?: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Speak `text` aloud, reliably, on desktop and mobile. Cancels anything already
 * speaking. Resolves the best voice from name → exact lang → language family.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!hasTTS()) {
    opts.onError?.();
    return;
  }
  const chunks = chunkText(text || "");
  if (chunks.length === 0) return;

  cancelSpeech();

  const voices = await getVoicesAsync();
  const base = (opts.lang || "").split("-")[0];
  const chosen =
    (opts.voiceName && voices.find((v) => v.name === opts.voiceName)) ||
    (opts.lang && voices.find((v) => v.lang === opts.lang)) ||
    (base && voices.find((v) => v.lang.split("-")[0] === base)) ||
    null;

  let i = 0;
  let startedFired = false;
  const next = () => {
    if (i >= chunks.length) {
      stopSpeechKeepAlive();
      opts.onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks[i++]);
    u.rate = opts.rate ?? 0.96;
    u.pitch = opts.pitch ?? 1;
    if (chosen) u.voice = chosen;
    u.lang = opts.lang || chosen?.lang || u.lang;
    if (!startedFired) {
      startedFired = true;
      u.onstart = () => opts.onStart?.();
    }
    u.onend = () => next();
    // Don't abort the whole reply if one chunk errors — keep going.
    u.onerror = () => next();
    try {
      window.speechSynthesis.speak(u);
    } catch {
      opts.onError?.();
    }
  };

  startSpeechKeepAlive();
  next();
}
