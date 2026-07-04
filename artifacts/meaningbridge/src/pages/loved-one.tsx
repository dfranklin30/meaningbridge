import { useState, useEffect, useRef } from "react";
import {
  useListDeceasedProfiles,
  useCreateDeceasedProfile,
  useUpdateDeceasedProfile,
  useDeleteDeceasedProfile,
  getListDeceasedProfilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Check, Plus, Trash2, UserRound } from "lucide-react";
import { PhotoGallery } from "../components/photo-gallery";

type FormState = {
  name: string;
  relationship: string;
  lossDate: string;
  lossType: string;
  personality: string;
  commonPhrases: string;
  memories: string;
  values: string;
  comfortLanguage: string;
  boundaries: string;
};

const emptyForm: FormState = {
  name: "",
  relationship: "",
  lossDate: "",
  lossType: "",
  personality: "",
  commonPhrases: "",
  memories: "",
  values: "",
  comfortLanguage: "",
  boundaries: "",
};

export default function LovedOne() {
  const queryClient = useQueryClient();
  const { data: profiles, isLoading } = useListDeceasedProfiles();

  // Which profile is loaded in the editor. `null` means "creating a new one".
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarned, setDuplicateWarned] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { mutateAsync: updateProfile } = useUpdateDeceasedProfile();
  const { mutateAsync: createProfile } = useCreateDeceasedProfile();
  const { mutateAsync: deleteProfile } = useDeleteDeceasedProfile();

  // Tracks whether the user deliberately chose "add another", so the default
  // selection effect doesn't yank them back to an existing profile.
  const hasChosenNew = useRef(false);

  const selected =
    selectedId !== null ? profiles?.find((p) => p.id === selectedId) : undefined;
  const isCreating = selectedId === null;

  // Default to the first profile once the list loads (unless the user has
  // deliberately started a new one).
  useEffect(() => {
    if (selectedId === null && !hasChosenNew.current && profiles && profiles.length > 0) {
      setSelectedId(profiles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  useEffect(() => {
    if (selected) {
      setFormData({
        name: selected.name || "",
        relationship: selected.relationship || "",
        lossDate: selected.lossDate ? String(selected.lossDate).slice(0, 10) : "",
        lossType: selected.lossType || "",
        personality: selected.personality || "",
        commonPhrases: selected.commonPhrases || "",
        memories: selected.memories || "",
        values: selected.values || "",
        comfortLanguage: selected.comfortLanguage || "",
        boundaries: selected.boundaries || "",
      });
    } else {
      setFormData(emptyForm);
    }
    setError(null);
    setDuplicateWarned(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectProfile = (id: number) => {
    hasChosenNew.current = false;
    setSelectedId(id);
  };

  const startNewProfile = () => {
    hasChosenNew.current = true;
    setSelectedId(null);
    setFormData(emptyForm);
    setError(null);
    setDuplicateWarned(false);
  };

  const handleSave = async () => {
    setError(null);

    if (!formData.name.trim() || !formData.relationship.trim()) {
      setError("Please share at least their name and your relationship to them.");
      return;
    }

    // Warn (once) before creating a profile whose name matches one that already
    // exists, so duplicates aren't made by accident.
    if (isCreating && !duplicateWarned) {
      const nameKey = formData.name.trim().toLowerCase();
      const dup = profiles?.some((p) => (p.name || "").trim().toLowerCase() === nameKey);
      if (dup) {
        setDuplicateWarned(true);
        return;
      }
    }

    setIsSaving(true);
    const payload = {
      name: formData.name.trim(),
      relationship: formData.relationship.trim(),
      lossDate: formData.lossDate ? formData.lossDate : null,
      lossType: formData.lossType.trim() || null,
      personality: formData.personality.trim() || null,
      commonPhrases: formData.commonPhrases.trim() || null,
      memories: formData.memories.trim() || null,
      values: formData.values.trim() || null,
      comfortLanguage: formData.comfortLanguage.trim() || null,
      boundaries: formData.boundaries.trim() || null,
    };

    try {
      if (selected) {
        await updateProfile({ id: selected.id, data: payload });
      } else {
        const created = await createProfile({ data: payload });
        hasChosenNew.current = false;
        if (created?.id) setSelectedId(created.id);
      }
      await queryClient.invalidateQueries({ queryKey: getListDeceasedProfilesQueryKey() });
      setDuplicateWarned(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteProfile({ id });
      await queryClient.invalidateQueries({ queryKey: getListDeceasedProfilesQueryKey() });
      setDeleteConfirmId(null);
      if (selectedId === id) {
        const remaining = (profiles ?? []).filter((p) => p.id !== id);
        if (remaining.length > 0) {
          hasChosenNew.current = false;
          setSelectedId(remaining[0].id);
        } else {
          startNewProfile();
        }
      }
    } catch (e) {
      console.error(e);
      setError("Something went wrong while removing this profile. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  const hasProfiles = (profiles?.length ?? 0) > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-foreground">Loved One</h1>
          <p className="text-muted-foreground">
            {selected
              ? "A sacred space to document who they were, and how you want to remember them."
              : "Begin a sacred space for the person you are remembering. You can return and add more whenever you are ready."}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : isSaving ? "Saving..." : selected ? "Save Profile" : "Create Profile"}
        </button>
      </div>

      {hasProfiles && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              People you are remembering
            </h2>
            <button
              onClick={startNewProfile}
              className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Add another
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profiles?.map((p) => {
              const active = p.id === selectedId;
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 rounded-full border pl-3 pr-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <button
                    onClick={() => selectProfile(p.id)}
                    className="flex items-center gap-2"
                  >
                    <UserRound className="w-3.5 h-3.5" />
                    <span className="font-medium">{p.name || "Unnamed"}</span>
                    {p.relationship && (
                      <span className="text-xs text-muted-foreground">· {p.relationship}</span>
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(p.id)}
                    aria-label={`Remove ${p.name || "this profile"}`}
                    className="text-muted-foreground/60 hover:text-destructive transition-colors p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {isCreating && (
              <span className="flex items-center gap-2 rounded-full border border-dashed border-primary/50 px-3 py-1.5 text-sm text-primary">
                <Plus className="w-3.5 h-3.5" /> New profile
              </span>
            )}
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-4 space-y-3">
          <p className="text-sm text-foreground">
            Remove{" "}
            <span className="font-medium">
              {profiles?.find((p) => p.id === deleteConfirmId)?.name || "this profile"}
            </span>
            ? This also removes any photos and details you have gathered here. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleDelete(deleteConfirmId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {duplicateWarned && (
        <div className="rounded-md border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm text-foreground">
          You already have a profile named{" "}
          <span className="font-medium">{formData.name.trim()}</span>. If this is a
          different person, press Create Profile again to continue. Otherwise, you can
          choose their existing profile above.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-8 bg-card border border-border rounded-xl p-6 md:p-8">
        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2">The Basics</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <input
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                value={formData.name}
                onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Relationship to you</label>
              <input
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                placeholder="e.g., mother, partner, friend..."
                value={formData.relationship}
                onChange={(e) => setFormData((d) => ({ ...d, relationship: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date of Loss</label>
              <input
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                type="date"
                value={formData.lossDate}
                onChange={(e) => setFormData((d) => ({ ...d, lossDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nature of Loss</label>
              <input
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                placeholder="e.g., sudden, expected, complicated..."
                value={formData.lossType}
                onChange={(e) => setFormData((d) => ({ ...d, lossType: e.target.value }))}
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2">Their Essence</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Personality</label>
              <textarea
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[100px]"
                placeholder="How would you describe their energy? What made them uniquely them?"
                value={formData.personality}
                onChange={(e) => setFormData((d) => ({ ...d, personality: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Common Phrases</label>
              <textarea
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[80px]"
                placeholder="Things they used to say all the time..."
                value={formData.commonPhrases}
                onChange={(e) => setFormData((d) => ({ ...d, commonPhrases: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Core Values</label>
              <textarea
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[80px]"
                placeholder="What mattered most to them?"
                value={formData.values}
                onChange={(e) => setFormData((d) => ({ ...d, values: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Cherished Memories</label>
              <textarea
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[120px]"
                placeholder="Moments you want to hold onto..."
                value={formData.memories}
                onChange={(e) => setFormData((d) => ({ ...d, memories: e.target.value }))}
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2">Your Boundaries</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Comforting Language</label>
              <textarea
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[80px]"
                placeholder="What words or concepts bring you comfort when thinking of them?"
                value={formData.comfortLanguage}
                onChange={(e) => setFormData((d) => ({ ...d, comfortLanguage: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Topics to Avoid</label>
              <textarea
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[80px]"
                placeholder="Are there aspects of their life or death you aren't ready to explore?"
                value={formData.boundaries}
                onChange={(e) => setFormData((d) => ({ ...d, boundaries: e.target.value }))}
              />
            </div>
          </div>
        </section>
      </div>

      {selected && (
        <div className="bg-card border border-border rounded-xl p-6 md:p-8">
          <PhotoGallery deceasedId={selected.id} />
        </div>
      )}
    </div>
  );
}
