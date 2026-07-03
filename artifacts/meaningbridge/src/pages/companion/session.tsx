import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetChatSession,
  getGetChatSessionQueryKey,
  useListDeceasedPhotos,
  getListDeceasedPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, ArrowLeft, AlertTriangle, User, ImagePlus, X, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceInput } from "../../components/voice-input";

type PendingImage = { id: string; dataUrl: string };

/** Read a File into a base64 data URL for ephemeral vision attachments. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

const CONVERSATION_LABELS: Record<string, string> = {
  open: "an open conversation",
  final: "something left unsaid",
  gratitude: "remembering with gratitude",
  forgiveness: "forgiveness",
  unfinished: "unfinished business",
  legacy: "their legacy in you",
  meaning: "making meaning",
};

// The companion's opening words, shown as its first message whenever a new
// (empty) session is opened. Calm and mode-aware — never a form or a checklist.
function introMessage(mode: string, conversationType?: string | null): string {
  const focus = conversationType ? CONVERSATION_LABELS[conversationType] : null;
  if (mode === "continuing-bonds") {
    return `Hello. I am here as a companion in remembering the person you are holding in your heart${
      focus ? `, and we can give this time to ${focus}` : ""
    }. There is no right way to do this, and nothing you need to prepare. When you are ready, you might begin by telling me a little about them — or we can simply sit together for a while.`;
  }
  return `Hello. I am here to sit with you as you make sense of what this loss has meant${
    focus ? `, with a gentle focus on ${focus}` : ""
  }. We can move as slowly as you need. Whenever you feel ready, share whatever is present for you, and we will find our way through it together.`;
}

export default function CompanionSession() {
  const { sessionId } = useParams();
  const id = parseInt(sessionId || "0");
  const queryClient = useQueryClient();
  const { data: session } = useGetChatSession(id, { query: { enabled: !!id, queryKey: getGetChatSessionQueryKey(id) } });
  const deceasedId = session?.deceasedId ?? 0;
  const { data: photos } = useListDeceasedPhotos(deceasedId, {
    query: { enabled: !!deceasedId, queryKey: getListDeceasedPhotosQueryKey(deceasedId) },
  });
  const photo = photos?.[0];

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [crisisAlert, setCrisisAlert] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [attachments, setAttachments] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [inflightMessage, setInflightMessage] = useState<string | null>(null);
  const [inflightImages, setInflightImages] = useState<string[]>([]);
  // Ephemeral: image thumbnails for user turns sent in this browser session,
  // keyed by their index in session.messages. Not persisted server-side, so
  // they survive stream completion within the session but clear on reload.
  const [sentImages, setSentImages] = useState<Record<number, string[]>>({});
  // Read replies aloud with the browser's built-in speech synthesis. Opt-in and
  // remembered across sessions. No network, no data leaves the device.
  const ttsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const [voiceOutput, setVoiceOutput] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("mb-voice-output") === "on";
  });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef("");
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  // Full assistant reply accumulated across deltas, for reading aloud once done.
  const fullReplyRef = useRef("");
  const voiceOutputRef = useRef(voiceOutput);
  voiceOutputRef.current = voiceOutput;

  const speakReply = (text: string) => {
    if (!ttsSupported || !text.trim()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis is best-effort; never let it interrupt the conversation.
    }
  };

  const toggleVoiceOutput = () => {
    setVoiceOutput((on) => {
      const next = !on;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("mb-voice-output", next ? "on" : "off");
      }
      if (!next && ttsSupported) window.speechSynthesis.cancel();
      return next;
    });
  };

  // Stop any speech when leaving the conversation.
  useEffect(() => {
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [ttsSupported]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, streamedResponse]);

  const stopReveal = () => {
    if (revealTimerRef.current !== null) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  useEffect(() => stopReveal, []);

  const finalize = () => {
    stopReveal();
    doneRef.current = false;
    pendingRef.current = "";
    if (voiceOutputRef.current) speakReply(fullReplyRef.current);
    queryClient.invalidateQueries({ queryKey: getGetChatSessionQueryKey(id) });
    setIsStreaming(false);
    setIsThinking(false);
    setStreamedResponse("");
    setInflightMessage(null);
    setInflightImages([]);
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImageError(null);
    const next: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) {
        setImageError("Please choose images under 5 MB.");
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        next.push({ id: crypto.randomUUID(), dataUrl });
      } catch {
        setImageError("That image could not be read. Please try another.");
      }
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 4));
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const startReveal = () => {
    if (revealTimerRef.current !== null) return;
    revealTimerRef.current = setInterval(() => {
      if (pendingRef.current.length > 0) {
        const take = Math.max(2, Math.ceil(pendingRef.current.length / 30));
        setStreamedResponse((prev) => prev + pendingRef.current.slice(0, take));
        pendingRef.current = pendingRef.current.slice(take);
      } else if (doneRef.current) {
        finalize();
      }
    }, 24);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    const userMessage = input.trim();
    const images = attachments.map((a) => a.dataUrl);
    // The just-sent user turn will be appended at this index in session.messages
    // (the intro is client-only and never stored). Remember its attachments so
    // the thumbnails persist in the transcript after streaming finishes.
    const userMessageIndex = session?.messages?.length ?? 0;
    setInput("");
    setAttachments([]);
    setImageError(null);
    setInflightMessage(userMessage);
    setInflightImages(images);
    if (images.length > 0) {
      setSentImages((prev) => ({ ...prev, [userMessageIndex]: images }));
    }
    setIsStreaming(true);
    setIsThinking(true);
    setStreamedResponse("");
    setCrisisAlert(false);
    setStreamError(false);
    pendingRef.current = "";
    doneRef.current = false;
    fullReplyRef.current = "";
    if (ttsSupported) window.speechSynthesis.cancel();

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/chat/sessions/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({
          content: userMessage,
          ...(images.length > 0 ? { images } : {}),
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "delta" && data.text) {
                setIsThinking(false);
                pendingRef.current += data.text;
                fullReplyRef.current += data.text;
                startReveal();
              } else if (data.type === "crisis") {
                setCrisisAlert(true);
              } else if (data.type === "done") {
                doneRef.current = true;
                startReveal();
              } else if (data.type === "error") {
                stopReveal();
                pendingRef.current = "";
                doneRef.current = false;
                setIsStreaming(false);
                setIsThinking(false);
                setStreamedResponse("");
                setStreamError(true);
              }
            } catch (err) {
              // Ignore parse errors on incomplete chunks
            }
          }
        }
      }
    } catch (err) {
      console.error("Streaming error:", err);
      stopReveal();
      pendingRef.current = "";
      doneRef.current = false;
      setIsStreaming(false);
      setIsThinking(false);
      setStreamError(true);
    }
  };

  if (!session) return null;

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border/50">
        <Link href="/companion" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        {session.mode === "continuing-bonds" && (
          <div className="w-9 h-9 rounded-full overflow-hidden bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
            {photo ? (
              <img
                src={`${import.meta.env.BASE_URL}api/storage${photo.objectPath}`}
                alt="Loved one"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
        )}
        <div>
          <h1 className="font-serif text-xl">{session.title}</h1>
          <p className="text-xs text-muted-foreground capitalize tracking-wide">
            {session.mode.replace('-', ' ')}
            {session.conversationType ? `, ${CONVERSATION_LABELS[session.conversationType] ?? session.conversationType}` : ""}
          </p>
        </div>
        {ttsSupported && (
          <button
            type="button"
            onClick={toggleVoiceOutput}
            aria-pressed={voiceOutput}
            aria-label={voiceOutput ? "Turn off reading replies aloud" : "Read replies aloud"}
            title={voiceOutput ? "Reading replies aloud" : "Read replies aloud"}
            className={`ml-auto w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              voiceOutput
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            {voiceOutput ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {crisisAlert && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">It sounds like you might be in deep pain right now.</p>
                <p className="text-xs text-destructive/80 mt-1 mb-2">If you are feeling overwhelmed, please know there is support available immediately.</p>
                <Link href="/crisis" className="text-xs font-medium text-destructive underline underline-offset-2">
                  View crisis resources
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto space-y-6 pb-4 pr-2">
        {!session.messages?.length && !isStreaming && !isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex justify-start"
          >
            <div className="max-w-[80%] rounded-2xl px-5 py-4 bg-card border border-border text-foreground">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {introMessage(session.mode, session.conversationType)}
              </div>
            </div>
          </motion.div>
        )}
        
        {session.messages?.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
              msg.role === 'user' 
                ? 'bg-primary text-primary-foreground ml-auto' 
                : 'bg-card border border-border text-foreground'
            }`}>
              {msg.role === 'user' && (sentImages[i]?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {sentImages[i]!.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      alt="An image you shared"
                      className="h-24 w-24 rounded-lg object-cover border border-primary-foreground/20"
                    />
                  ))}
                </div>
              )}
              {msg.content && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        
        {inflightMessage !== null && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl px-5 py-4 bg-primary text-primary-foreground ml-auto">
              {inflightImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {inflightImages.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      alt="An image you shared"
                      className="h-24 w-24 rounded-lg object-cover border border-primary-foreground/20"
                    />
                  ))}
                </div>
              )}
              {inflightMessage && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{inflightMessage}</div>
              )}
            </div>
          </div>
        )}

        {isThinking && !streamedResponse && (
          <div className="flex justify-start">
            <div
              className="max-w-[80%] rounded-2xl px-5 py-4 bg-card border border-border"
              aria-label="The companion is reflecting"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:200ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:400ms]" />
              </div>
            </div>
          </div>
        )}

        {isStreaming && streamedResponse && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-5 py-4 bg-card border border-border text-foreground">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{streamedResponse}</div>
            </div>
          </div>
        )}

        {streamError && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-5 py-4 bg-muted/40 border border-border text-sm text-muted-foreground leading-relaxed">
              Something interrupted our conversation before the reply came through. Please take your
              time, and send your message again when you are ready.
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="pt-4 mt-auto">
        {imageError && (
          <p className="text-xs text-destructive mb-2 px-1">{imageError}</p>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border"
              >
                <img src={att.dataUrl} alt="Attached preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  aria-label="Remove attachment"
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-background border border-border rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
          <VoiceInput
            className="mb-0.5"
            disabled={isStreaming}
            onTranscript={(text) =>
              setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
            }
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isStreaming || attachments.length >= 4}
            aria-label="Attach an image"
            title="Attach an image"
            className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50 mb-0.5"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleImageFiles(e.target.files)}
          />
          <textarea
            className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none resize-none focus:ring-0 px-3 py-2.5 text-sm"
            placeholder="Write here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button 
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || isStreaming}
            className="w-10 h-10 shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 transition-opacity mb-0.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}