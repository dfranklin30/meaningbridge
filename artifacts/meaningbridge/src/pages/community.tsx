import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { io, type Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ArrowLeft,
  Send,
  Flag,
  Loader2,
  ShieldCheck,
  HeartHandshake,
} from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;
const SOCKET_PATH = `${import.meta.env.BASE_URL}api/socket.io`;

type RoomSummary = {
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  onlineCount: number;
  online: string[];
  joined: boolean;
};

type ChatMessage = {
  id: number;
  screenName: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

type Suggestion = { slug: string; name: string; reason: string } | null;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Community() {
  const params = useParams();
  const slug = params.slug;

  const [screenName, setScreenName] = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`${API}/community/identity`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { screenName: string | null };
          if (active) setScreenName(data.screenName);
        }
      } catch {
        // Leave screenName null; the gate will offer to set one.
      } finally {
        if (active) setIdentityLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!identityLoaded) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!screenName) {
    return <ScreenNameGate onSet={setScreenName} />;
  }

  if (slug) {
    return <RoomView slug={slug} screenName={screenName} />;
  }

  return <RoomList screenName={screenName} onChangeName={() => setScreenName(null)} />;
}

function ScreenNameGate({ onSet }: { onSet: (name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API}/community/identity`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenName: name.trim() }),
      });
      const data = (await res.json()) as { screenName?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "That name could not be saved. Please try another.");
        return;
      }
      if (data.screenName) onSet(data.screenName);
    } catch {
      setError("That name could not be saved just now. Please try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 py-6">
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80">Community</p>
        <h1 className="text-3xl font-serif text-foreground">A name to be known by</h1>
        <p className="text-muted-foreground leading-relaxed">
          The community rooms are spaces to sit with others who understand. Choose a
          screen name to use here. It can be your first name or something gentler; it
          does not have to be your real name. Please leave out anything that could
          identify you or another person.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your screen name"
          maxLength={24}
          className="w-full bg-background border border-border rounded-md px-4 py-3 text-base focus:ring-1 focus:ring-primary/50 outline-none"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={saving || name.trim().length < 3}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving..." : "Enter the community"}
        </button>
      </form>
    </div>
  );
}

function RoomList({
  screenName,
  onChangeName,
}: {
  screenName: string;
  onChangeName: () => void;
}) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<Suggestion>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [roomsRes, sugRes] = await Promise.all([
          fetch(`${API}/community/rooms`, { credentials: "include" }),
          fetch(`${API}/community/suggested-room`, { credentials: "include" }),
        ]);
        if (roomsRes.ok) {
          const data = (await roomsRes.json()) as { rooms: RoomSummary[] };
          if (active) setRooms(data.rooms);
        }
        if (sugRes.ok) {
          const data = (await sugRes.json()) as { suggestion: Suggestion };
          if (active) setSuggestion(data.suggestion);
        }
      } catch {
        // A failed list leaves an empty state below.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-serif text-foreground">Community</h1>
          <button
            type="button"
            onClick={onChangeName}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Here as {screenName}
          </button>
        </div>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Quiet rooms to be among others who are grieving. Take what helps and leave
          the rest. These are peer spaces, not clinical care. If you are in crisis,
          the crisis support page is on every screen.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          For everyone's safety, messages are gently screened. Anything that suggests
          someone is in danger is never shared publicly; instead that person is offered
          support right away.
        </p>
      </div>

      {suggestion && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <HeartHandshake className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-sm text-foreground/80 leading-relaxed font-serif italic">
              {suggestion.reason}
            </p>
          </div>
          <Link
            href={`/community/${suggestion.slug}`}
            className="inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Visit {suggestion.name}
          </Link>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rooms.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">
          No rooms are available just now.
        </p>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => (
            <Link
              key={room.slug}
              href={`/community/${room.slug}`}
              className="block rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <h2 className="text-xl font-serif">{room.name}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {room.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Users className="w-3.5 h-3.5" />
                  <span>{room.onlineCount} here now</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type SystemLine = { kind: "system"; id: string; text: string };
type Feed = (ChatMessage | SystemLine)[];

function RoomView({ slug, screenName }: { slug: string; screenName: string }) {
  const [, setLocation] = useLocation();
  const [feed, setFeed] = useState<Feed>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [roomName, setRoomName] = useState(slug);
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Resolve the human room name for the header.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`${API}/community/rooms`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { rooms: RoomSummary[] };
          const match = data.rooms.find((r) => r.slug === slug);
          if (active && match) setRoomName(match.name);
        }
      } catch {
        // Fall back to the slug as the header.
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    const socket = io({
      path: SOCKET_PATH,
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:join", { slug });
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("history", (payload: { slug: string; messages: ChatMessage[] }) => {
      if (payload.slug !== slug) return;
      setFeed(payload.messages);
    });

    socket.on("message:new", (msg: ChatMessage & { slug: string }) => {
      if (msg.slug !== slug) return;
      setFeed((prev) => [
        ...prev,
        { id: msg.id, screenName: msg.screenName, body: msg.body, createdAt: msg.createdAt, mine: msg.mine },
      ]);
    });

    socket.on("system", (payload: { slug: string; text: string }) => {
      if (payload.slug !== slug) return;
      setFeed((prev) => [
        ...prev,
        { kind: "system", id: `sys-${Date.now()}-${Math.random()}`, text: payload.text },
      ]);
    });

    socket.on("presence", (payload: { slug: string; online: string[] }) => {
      if (payload.slug !== slug) return;
      setOnline(payload.online);
    });

    socket.on(
      "typing",
      (payload: { slug: string; screenName: string; isTyping: boolean }) => {
        if (payload.slug !== slug) return;
        setTypingNames((prev) => {
          const without = prev.filter((n) => n !== payload.screenName);
          return payload.isTyping ? [...without, payload.screenName] : without;
        });
      },
    );

    socket.on("message:removed", (payload: { slug: string; id: number }) => {
      if (payload.slug !== slug) return;
      setFeed((prev) =>
        prev.filter((item) => "kind" in item || item.id !== payload.id),
      );
    });

    socket.on("crisis", (payload: { message: string }) => {
      setCrisis(payload.message);
    });
    socket.on("message:blocked", (payload: { reason: string }) => {
      setNotice(payload.reason);
    });
    socket.on("error:message", (payload: { reason: string }) => {
      setNotice(payload.reason);
    });

    return () => {
      socket.emit("room:leave", { slug });
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [slug]);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [feed, typingNames]);

  const stopTyping = () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current?.emit("typing", { slug, isTyping: false });
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!isTypingRef.current && value.trim()) {
      isTypingRef.current = true;
      socketRef.current?.emit("typing", { slug, isTyping: true });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 1800);
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    socketRef.current?.emit("message:send", { slug, body });
    setDraft("");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    stopTyping();
  };

  const report = async (id: number) => {
    setNotice(null);
    try {
      await fetch(`${API}/community/messages/${id}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Reported by a member" }),
      });
      setNotice("Thank you. A moderator will take a look.");
    } catch {
      setNotice("That report could not be sent just now. Please try again in a moment.");
    }
  };

  const typingLabel = useMemo(() => {
    if (typingNames.length === 0) return "";
    if (typingNames.length === 1) return `${typingNames[0]} is typing`;
    if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing`;
    return "Several people are typing";
  }, [typingNames]);

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-12rem)] min-h-[420px]">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setLocation("/community")}
            aria-label="Back to rooms"
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-serif truncate">{roomName}</h1>
            <p className="text-xs text-muted-foreground">
              {connected ? `${online.length} here now` : "Connecting..."}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span className="truncate max-w-[16rem]">{online.join(", ")}</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3">
        {feed.length === 0 && connected && (
          <p className="text-center text-sm text-muted-foreground py-8">
            This room is quiet. You are welcome to be the first to say hello.
          </p>
        )}
        {feed.map((item) =>
          "kind" in item ? (
            <p key={item.id} className="text-center text-xs text-muted-foreground/80 py-1">
              {item.text}
            </p>
          ) : (
            <div
              key={item.id}
              className={`flex flex-col max-w-[80%] ${item.mine ? "ml-auto items-end" : "items-start"}`}
            >
              {!item.mine && (
                <span className="text-xs text-muted-foreground mb-1 px-1">{item.screenName}</span>
              )}
              <div
                className={`group relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  item.mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary/60 text-foreground rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{item.body}</p>
                {!item.mine && (
                  <button
                    type="button"
                    onClick={() => void report(item.id)}
                    aria-label="Report this message"
                    title="Report this message"
                    className="absolute -right-7 top-1/2 -translate-y-1/2 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/60 mt-1 px-1">
                {formatTime(item.createdAt)}
              </span>
            </div>
          ),
        )}
        {typingLabel && (
          <p className="text-xs text-muted-foreground/80 px-1 italic">{typingLabel}</p>
        )}
      </div>

      <AnimatePresence>
        {crisis && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground/80 leading-relaxed"
          >
            <p>{crisis}</p>
            <Link
              href="/crisis"
              className="inline-block mt-2 text-sm font-medium text-primary underline underline-offset-4"
            >
              Open crisis support
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {notice && (
        <div className="mb-3 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      )}

      <form onSubmit={send} className="flex items-end gap-2 pt-3 border-t border-border/50">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          placeholder={`Share something with the room, ${screenName}`}
          rows={1}
          className="flex-1 resize-none bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary/50 outline-none max-h-32"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          aria-label="Send message"
          className="shrink-0 w-11 h-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
