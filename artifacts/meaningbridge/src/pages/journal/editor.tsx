import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useGetJournalEntry, useCreateJournalEntry, useUpdateJournalEntry, useDeleteJournalEntry, useListJournalPrompts, getListJournalEntriesQueryKey, getGetJournalEntryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, Check } from "lucide-react";
import { VoiceInput } from "../../components/voice-input";

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

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [promptId, setPromptId] = useState<number | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (entry && !initialized.current) {
      setTitle(entry.title);
      setBody(entry.body);
      setCategory(entry.category);
      setPromptId(entry.promptId || null);
      initialized.current = true;
    }
  }, [entry]);

  useEffect(() => {
    if (isNew && promptIdParam && prompts && !initialized.current) {
      const pid = parseInt(promptIdParam);
      const prompt = prompts.find(p => p.id === pid);
      if (prompt) {
        setTitle("Response: " + prompt.title);
        setPromptId(pid);
        setCategory(prompt.category);
      }
      initialized.current = true;
    }
  }, [isNew, promptIdParam, prompts]);

  const handleSave = async () => {
    if (!title.trim() && !body.trim()) return;
    setIsSaving(true);
    
    try {
      if (isNew) {
        const res = await createEntry({
          data: { title: title || "Untitled Entry", body, category, promptId }
        });
        queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
        setLocation(`/journal/${res.id}`, { replace: true });
      } else {
        await updateEntry({
          id: entryId,
          data: { title: title || "Untitled Entry", body, category, promptId }
        });
        queryClient.invalidateQueries({ queryKey: getGetJournalEntryQueryKey(entryId) });
        queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isNew && confirm("Are you sure you want to delete this entry?")) {
      await deleteEntry({ id: entryId });
      queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
      setLocation("/journal");
    }
  };

  const currentPrompt = prompts?.find(p => p.id === promptId);

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

      <div className="flex-1 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <select 
            value={category} 
            onChange={e => setCategory(e.target.value)}
            className="bg-secondary/50 border-none text-xs uppercase tracking-wider rounded px-3 py-1.5 focus:ring-1 focus:ring-primary/50 outline-none"
          >
            <option value="general">General</option>
            <option value="memory">Memory</option>
            <option value="letter">Letter</option>
            <option value="processing">Processing</option>
            <option value="meaning">Meaning</option>
          </select>
        </div>

        {currentPrompt && (
          <div className="bg-secondary/30 rounded-lg p-4 text-sm text-foreground/80 border border-border/50 font-serif italic">
            "{currentPrompt.prompt}"
          </div>
        )}

        <input 
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Entry Title"
          className="text-3xl md:text-4xl font-serif bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-muted-foreground/50"
        />

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Begin writing..."
          className="flex-1 w-full bg-transparent border-none outline-none focus:ring-0 p-0 resize-none leading-relaxed text-base md:text-lg placeholder:text-muted-foreground/30 min-h-[300px]"
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
      </div>
    </div>
  );
}