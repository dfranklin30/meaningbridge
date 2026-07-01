import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useGetPractice,
  useCreatePractice,
  useUpdatePractice,
  useDeletePractice,
  getGetPracticeQueryKey,
  getListPracticesQueryKey,
} from "@workspace/api-client-react";
import type { PracticeInputBreathPatternItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, Check, Plus, X, ArrowUp, ArrowDown } from "lucide-react";

const CATEGORIES = ["breathwork", "meditation", "art", "ritual", "reflection"];

type Phase = PracticeInputBreathPatternItem;

export default function PracticeEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const practiceId = parseInt(id || "0");

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: practice } = useGetPractice(practiceId, {
    query: { enabled: !isNew && !!practiceId, queryKey: getGetPracticeQueryKey(practiceId) },
  });

  const { mutateAsync: createPractice } = useCreatePractice();
  const { mutateAsync: updatePractice } = useUpdatePractice();
  const { mutateAsync: deletePractice } = useDeletePractice();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("breathwork");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [hasCounter, setHasCounter] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (practice && !initialized.current) {
      setTitle(practice.title);
      setCategory(practice.category);
      setDurationMinutes(practice.durationMinutes);
      setSummary(practice.summary);
      setSteps(practice.steps.length ? practice.steps : [""]);
      const bp = practice.breathPattern ?? [];
      setHasCounter(bp.length > 0);
      setPhases(bp);
      initialized.current = true;
    }
  }, [practice]);

  const updateStep = (i: number, value: string) =>
    setSteps((s) => s.map((step, idx) => (idx === i ? value : step)));
  const addStep = () => setSteps((s) => [...s, ""]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const updatePhase = (i: number, patch: Partial<Phase>) =>
    setPhases((p) => p.map((phase, idx) => (idx === i ? { ...phase, ...patch } : phase)));
  const addPhase = () =>
    setPhases((p) => [...p, { label: "Inhale", seconds: 4, scale: 1.2 }]);
  const removePhase = (i: number) => setPhases((p) => p.filter((_, idx) => idx !== i));
  const movePhase = (i: number, dir: -1 | 1) =>
    setPhases((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const toggleCounter = () => {
    setHasCounter((on) => {
      if (!on && phases.length === 0) {
        setPhases([
          { label: "Inhale", seconds: 4, scale: 1.3 },
          { label: "Hold", seconds: 4, scale: 1.3 },
          { label: "Exhale", seconds: 4, scale: 0.7 },
        ]);
      }
      return !on;
    });
  };

  const handleSave = async () => {
    setError(null);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) { setError("A title is needed."); return; }
    if (!summary.trim()) { setError("A short summary is needed."); return; }
    if (cleanSteps.length === 0) { setError("Add at least one step."); return; }

    const cleanPhases: Phase[] = hasCounter
      ? phases
          .map((p) => ({ label: p.label.trim(), seconds: p.seconds, scale: p.scale }))
          .filter((p) => p.label && p.seconds > 0)
      : [];
    if (hasCounter && cleanPhases.length === 0) {
      setError("Add at least one breath phase, or turn off the counter.");
      return;
    }

    const data = {
      title: title.trim(),
      category,
      durationMinutes: Math.max(1, Math.round(durationMinutes) || 1),
      summary: summary.trim(),
      steps: cleanSteps,
      breathPattern: hasCounter ? cleanPhases : null,
    };

    setIsSaving(true);
    try {
      if (isNew) {
        const res = await createPractice({ data });
        queryClient.invalidateQueries({ queryKey: getListPracticesQueryKey() });
        setLocation(`/practices/${res.id}/edit`, { replace: true });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        await updatePractice({ id: practiceId, data });
        queryClient.invalidateQueries({ queryKey: getGetPracticeQueryKey(practiceId) });
        queryClient.invalidateQueries({ queryKey: getListPracticesQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error(e);
      setError("Something went wrong saving this practice. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (!confirm("Remove this practice from the library? This cannot be undone.")) return;
    try {
      await deletePractice({ id: practiceId });
      queryClient.invalidateQueries({ queryKey: getListPracticesQueryKey() });
      setLocation("/practices");
    } catch (e) {
      console.error(e);
      setError("Could not remove this practice. Please try again.");
    }
  };

  const fieldCls =
    "w-full bg-secondary/30 border border-border/60 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 transition-all";

  return (
    <div className="max-w-2xl mx-auto min-h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
        <Link
          href="/practices"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Remove practice"
            >
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

      <div className="space-y-1 mb-8">
        <h1 className="text-2xl font-serif text-foreground">
          {isNew ? "New practice" : "Edit practice"}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Curate the title, steps, and breath rhythm. Changes appear in the player right away.
        </p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-7">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Box breathing"
            className={fieldCls}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
              className={fieldCls}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A short, calm description of this practice."
            rows={3}
            className={`${fieldCls} resize-none leading-relaxed`}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Steps</label>
            <button
              onClick={addStep}
              className="flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Add step
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-serif text-sm text-muted-foreground w-5 pt-2.5 text-right">{i + 1}</span>
                <textarea
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder="Describe this step..."
                  rows={2}
                  className={`${fieldCls} resize-none leading-relaxed flex-1`}
                />
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary/50 disabled:opacity-30 transition-all"
                    aria-label="Move step up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveStep(i, 1)}
                    disabled={i === steps.length - 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary/50 disabled:opacity-30 transition-all"
                    aria-label="Move step down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeStep(i)}
                    disabled={steps.length === 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-all"
                    aria-label="Remove step"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium text-foreground">Breath counter</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                An on-screen pacer that breathes through the phases below.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleCounter}
              role="switch"
              aria-checked={hasCounter}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                hasCounter ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                  hasCounter ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {hasCounter && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 flex-1 mr-[6.5rem]">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Phase label</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Seconds</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Scale</span>
                </div>
              </div>
              {phases.map((phase, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 flex-1">
                    <input
                      type="text"
                      value={phase.label}
                      onChange={(e) => updatePhase(i, { label: e.target.value })}
                      placeholder="Inhale"
                      className={fieldCls}
                    />
                    <input
                      type="number"
                      min={1}
                      value={phase.seconds}
                      onChange={(e) => updatePhase(i, { seconds: parseInt(e.target.value) || 0 })}
                      className={fieldCls}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={phase.scale}
                      onChange={(e) => updatePhase(i, { scale: parseFloat(e.target.value) || 0 })}
                      className={fieldCls}
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => movePhase(i, -1)}
                      disabled={i === 0}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary/50 disabled:opacity-30 transition-all"
                      aria-label="Move phase up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => movePhase(i, 1)}
                      disabled={i === phases.length - 1}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary/50 disabled:opacity-30 transition-all"
                      aria-label="Move phase down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removePhase(i)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      aria-label="Remove phase"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scale sets how the circle grows or shrinks during a phase — above 1 expands (inhale), below 1 contracts (exhale).
              </p>
              <button
                onClick={addPhase}
                className="flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> Add phase
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
