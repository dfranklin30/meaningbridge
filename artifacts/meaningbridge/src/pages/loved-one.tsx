import { useState, useEffect } from "react";
import {
  useListDeceasedProfiles,
  useCreateDeceasedProfile,
  useUpdateDeceasedProfile,
  getListDeceasedProfilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Check } from "lucide-react";

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
  const deceased = profiles?.[0];

  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: updateProfile } = useUpdateDeceasedProfile();
  const { mutateAsync: createProfile } = useCreateDeceasedProfile();

  useEffect(() => {
    if (deceased) {
      setFormData({
        name: deceased.name || "",
        relationship: deceased.relationship || "",
        lossDate: deceased.lossDate ? String(deceased.lossDate).slice(0, 10) : "",
        lossType: deceased.lossType || "",
        personality: deceased.personality || "",
        commonPhrases: deceased.commonPhrases || "",
        memories: deceased.memories || "",
        values: deceased.values || "",
        comfortLanguage: deceased.comfortLanguage || "",
        boundaries: deceased.boundaries || "",
      });
    }
  }, [deceased]);

  const handleSave = async () => {
    setError(null);

    if (!formData.name.trim() || !formData.relationship.trim()) {
      setError("Please share at least their name and your relationship to them.");
      return;
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
      if (deceased) {
        await updateProfile({ id: deceased.id, data: payload });
      } else {
        await createProfile({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: getListDeceasedProfilesQueryKey() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-foreground">Loved One</h1>
          <p className="text-muted-foreground">
            {deceased
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
          {saved ? "Saved" : isSaving ? "Saving..." : deceased ? "Save Profile" : "Create Profile"}
        </button>
      </div>

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
    </div>
  );
}
