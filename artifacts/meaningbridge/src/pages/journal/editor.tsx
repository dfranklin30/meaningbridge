import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useGetJournalEntry,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  useListJournalPrompts,
  useReflectOnJournalEntry,
  getListJournalEntriesQueryKey,
  getGetJournalEntryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, Check, Sparkle, Lock, LifeBuoy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceInput } from "../../components/voice-input";

type Privacy = "private" | "shared" | "share-later";

const PRIVACY_OPTIONS: { value: Privacy; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "Only you can read this." },
  { value: "shared", label: "Shared with your care team", hint: "Visible to a therapist you are working with." },
  { value: "share-later", label: "Decide later", hint: "Kept private for now; you can share it another time." },
];

export default function JournalEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const entryId = parseInt(id || "0");

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const promptIdParam = searchParams.get("promptId");

  const { data: entry } = useGetJournalEntry(entryId, { query: { enabled: !isNew, queryKey: getGetJournalEntryQueryKey(entryId) } });
  const { data: prompts } = useListJournalPrompts();

  const { mutateAsync: createEntry } = useCreateJournalEntry();
  const { mutateAsync: updateEntry } = useUpdateJournalEntry();
  const { mutateAsync: deleteEntry } = useDeleteJournalEntry();
  const { mutateAsync: reflect } = useReflectOnJournalEntry();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [promptId, setPromptId] = useState<number | null>(null);
  const [mood, setMood] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("private");

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const initialized = useRef(false);

  const [reflection, setReflection] = useState<string | null>(null);
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectError, setReflectError] = useState(false);
  const [suggestShare, setSuggestShare] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);

  useEffect(() => {
    if (entry && !initialized.current) {
      setTitle(entry.title);
      setBody(entry.body);
      setCategory(entry.category);
      setPromptId(entry.promptId || null);
      setMood(entry.mood || "");
      setPrivacy((entry.privacyStatus as Privacy) || "private");
      setReflection(entry.aiReflection || null);
      initialized.current = true;
    }
  }, [entry]);

  useEffect(() => {
    if (isNew && promptIdParam && prompts && !initialized.current) {
      const pid = parseInt(promptIdParam);
      const prompt = prompts.find((p) => p.id === pid);
      if (prompt) {
        setTitle("Response: " + prompt.title);
        setPromptId(pid);
        setCategory(prompt.category);
      }
      initialized.current = true;
    }
  }, [isNew, promptIdParam, prompts]);

  const buildData = () => ({
    title: title || "Untitled Entry",
    body,
    category,
    promptId,
    mood: mood.trim() || null,
    privacyStatus: privacy,
    sharedWithTherapist: privacy === "shared",
  });

  const handleSave = async () => {
    if (!title.trim() && !body.trim()) return;
    setIsSaving(true);
    setSaveError(false);

    try {
      if (isNew) {
        const res = await createEntry({ data: buildData() });
        queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
        setLocation(`/journal/${res.id}`, { replace: true });
      } else {
        await updateEntry({ id: entryId, data: buildData() });
        queryClient.invalidateQueries({ queryKey: getGetJournalEntryQueryKey(entryId) });
        queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error(e);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReflect = async () => {
    if (isNew || isReflecting) return;
    setIsReflecting(true);
    setReflectError(false);
    setSuggestShare(false);
    try {
      // Save any unsaved changes first so the reflection reads the latest text.
      await updateEntry({ id: entryId, data: buildData() });
      const res = await reflect({ id: entryId });
      setReflection(res.reflection);
      setSuggestShare(res.suggestShare);
      if (res.showCrisisSupport) setShowCrisis(true);
      queryClient.invalidateQueries({ queryKey: getGetJournalEntryQueryKey(entryId) });
      queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
    } catch (e) {
      console.error(e);
      setReflectError(true);
    } finally {
      setIsReflecting(false);
    }
  };

  const [shareState, setShareState] = useState<"idle" | "sharing" | "done" | "error">("idle");

  const handleShareWithTeam = async () => {
    setShareState("sharing");
    try {
      await updateEntry({ id: entryId, data: { ...buildData(), privacyStatus: "shared", sharedWithTherapist: true } });
      setPrivacy("shared");
      setSuggestShare(false);
      setShareState("done");
      queryClient.invalidateQueries({ queryKey: getGetJournalEntryQueryKey(entryId) });
      queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
    } catch (e) {
      console.error(e);
      setShareState("error");
    }
  };

  const handleDelete = async () => {
    if (!isNew && confirm("Are you sure you want to delete this entry?")) {
      await deleteEntry({ id: entryId });
      queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
      setLocation("/journal");
    }
  };

  const currentPrompt = prompts?.find((p) => p.id === promptId);

  return (
    <div className="max-w-3xl mx-auto min-h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
        <Link href="/journal" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button onClick={handleDelete} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved" : isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This entry could not be saved just now. Please check your connection and try again.
        </div>
      )}

      <div className="flex-1 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-secondary/50 border-none text-xs uppercase tracking-wider rounded px-3 py-1.5 focus:ring-1 focus:ring-primary/50 outline-none"
          >
            <option value="general">General</option>
            <option value="memory">Memory</option>
            <option value="letter">Letter</option>
            <option value="processing">Processing</option>
            <option value="meaning">Meaning</option>
          </select>
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="A word for how you feel"
            maxLength={24}
            className="bg-secondary/50 border-none text-xs rounded px-3 py-1.5 focus:ring-1 focus:ring-primary/50 outline-none w-48 placeholder:text-muted-foreground/60"
          />
        </div>

        {currentPrompt && (
          <div className="bg-secondary/30 rounded-lg p-4 text-sm text-foreground/80 border border-border/50 font-serif italic">
            "{currentPrompt.prompt}"
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry Title"
          className="text-3xl md:text-4xl font-serif bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-muted-foreground/50"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Begin writing..."
          className="flex-1 w-full bg-transparent border-none outline-none focus:ring-0 p-0 resize-none leading-relaxed text-base md:text-lg placeholder:text-muted-foreground/30 min-h-[240px]"
        />

        <div className="flex items-start gap-3 pt-2 border-t border-border/40">
          <VoiceInput
            onTranscript={(text) =>
              setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
            }
          />
          <p className="text-xs text-muted-foreground mt-2.5">
            Speak a memory and it will appear here for you to review before saving.
          </p>
        </div>

        <div className="space-y-3 pt-4 border-t border-border/40">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            <span>Who can see this entry</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {PRIVACY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrivacy(opt.value)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  privacy === opt.value
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-secondary/30"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkle className="w-4 h-4 text-primary" />
              <h2 className="font-serif text-lg">A gentle reflection</h2>
            </div>
            <button
              type="button"
              onClick={handleReflect}
              disabled={isNew || isReflecting}
              className="text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
            >
              {isReflecting ? "Reflecting..." : reflection ? "Reflect again" : "Ask for a reflection"}
            </button>
          </div>
          {isNew && (
            <p className="text-xs text-muted-foreground">
              Save your entry first, and the companion can offer a short, unhurried reflection when you are ready.
            </p>
          )}
          {reflectError && (
            <p className="text-sm text-muted-foreground">
              The reflection could not be offered just now. You can try again in a moment.
            </p>
          )}
          <AnimatePresence>
            {reflection && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-lg border border-border bg-card p-5 text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap font-serif"
              >
                {reflection}
              </motion.div>
            )}
          </AnimatePresence>
          {suggestShare && privacy !== "shared" && (
            <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm">
              <p className="text-muted-foreground mb-3">
                If it would help, you can let a therapist you are working with read this entry.
              </p>
              <button
                type="button"
                onClick={handleShareWithTeam}
                disabled={shareState === "sharing"}
                className="text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
              >
                {shareState === "sharing" ? "Sharing..." : "Share this with your care team"}
              </button>
              {shareState === "error" && (
                <p className="mt-2 text-xs text-destructive">
                  This could not be shared just now. Please check your connection and try again.
                </p>
              )}
            </div>
          )}
          {(privacy === "shared" || shareState === "done") && (
            <p className="text-xs text-muted-foreground">
              This entry is shared with your care team. You can change who can see it above at any time.
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCrisis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.4 }}
              className="max-w-md w-full rounded-xl border border-border bg-card p-6 shadow-lg"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <h2 className="font-serif text-xl mb-2">You do not have to carry this alone</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                What you wrote suggests you may be in a lot of pain. Support is available right now, and reaching out is a caring thing to do for yourself.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/crisis"
                  className="w-full text-center bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  See support options
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCrisis(false)}
                  className="w-full text-center text-sm text-muted-foreground py-2 hover:text-foreground transition-colors"
                >
                  Return to your entry
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
