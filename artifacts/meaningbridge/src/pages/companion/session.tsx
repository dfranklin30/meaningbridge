import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetChatSession,
  getGetChatSessionQueryKey,
  useListDeceasedPhotos,
  getListDeceasedPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, ArrowLeft, AlertTriangle, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceInput } from "../../components/voice-input";

const CONVERSATION_LABELS: Record<string, string> = {
  open: "an open conversation",
  final: "something left unsaid",
  gratitude: "remembering with gratitude",
  forgiveness: "forgiveness",
  unfinished: "unfinished business",
  legacy: "their legacy in you",
  meaning: "making meaning",
};

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
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef("");
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

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
    queryClient.invalidateQueries({ queryKey: getGetChatSessionQueryKey(id) });
    setIsStreaming(false);
    setIsThinking(false);
    setStreamedResponse("");
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
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    setIsThinking(true);
    setStreamedResponse("");
    setCrisisAlert(false);
    setStreamError(false);
    pendingRef.current = "";
    doneRef.current = false;

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/chat/sessions/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({ content: userMessage })
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
        {session.messages?.length === 0 && (
          <div className="h-full flex items-center justify-center text-center">
            <p className="text-muted-foreground max-w-sm text-sm">
              I am here to listen. You can share whatever is on your mind, or we can just sit together in the quiet.
            </p>
          </div>
        )}
        
        {session.messages?.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
              msg.role === 'user' 
                ? 'bg-primary text-primary-foreground ml-auto' 
                : 'bg-card border border-border text-foreground'
            }`}>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        
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
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-background border border-border rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
          <VoiceInput
            className="mb-0.5"
            disabled={isStreaming}
            onTranscript={(text) =>
              setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
            }
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
            disabled={!input.trim() || isStreaming}
            className="w-10 h-10 shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 transition-opacity mb-0.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}