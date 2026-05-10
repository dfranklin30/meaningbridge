import { useState, useEffect } from "react";
import { useListDeceasedProfiles, useUpdateDeceasedProfile, getListDeceasedProfilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Check } from "lucide-react";

export default function LovedOne() {
  const queryClient = useQueryClient();
  const { data: profiles } = useListDeceasedProfiles();
  const deceased = profiles?.[0];

  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    lossDate: "",
    lossType: "",
    personality: "",
    commonPhrases: "",
    memories: "",
    values: "",
    comfortLanguage: "",
    boundaries: ""
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { mutateAsync: updateProfile } = useUpdateDeceasedProfile();

  useEffect(() => {
    if (deceased) {
      setFormData({
        name: deceased.name || "",
        relationship: deceased.relationship || "",
        lossDate: deceased.lossDate || "",
        lossType: deceased.lossType || "",
        personality: deceased.personality || "",
        commonPhrases: deceased.commonPhrases || "",
        memories: deceased.memories || "",
        values: deceased.values || "",
        comfortLanguage: deceased.comfortLanguage || "",
        boundaries: deceased.boundaries || ""
      });
    }
  }, [deceased]);

  const handleSave = async () => {
    if (!deceased) return;
    setIsSaving(true);
    try {
      await updateProfile({
        id: deceased.id,
        data: formData
      });
      queryClient.invalidateQueries({ queryKey: getListDeceasedProfilesQueryKey() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!deceased) {
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
          <p className="text-muted-foreground">A sacred space to document who they were, and how you want to remember them.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : isSaving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="space-y-8 bg-card border border-border rounded-xl p-6 md:p-8">
        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2">The Basics</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <input 
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                value={formData.name}
                onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Relationship to you</label>
              <input 
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                value={formData.relationship}
                onChange={e => setFormData(d => ({ ...d, relationship: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date of Loss</label>
              <input 
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                type="date"
                value={formData.lossDate?.split('T')[0] || ''}
                onChange={e => setFormData(d => ({ ...d, lossDate: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nature of Loss</label>
              <input 
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                placeholder="e.g., sudden, expected, complicated..."
                value={formData.lossType}
                onChange={e => setFormData(d => ({ ...d, lossType: e.target.value }))}
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
                onChange={e => setFormData(d => ({ ...d, personality: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Common Phrases</label>
              <textarea 
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[80px]"
                placeholder="Things they used to say all the time..."
                value={formData.commonPhrases}
                onChange={e => setFormData(d => ({ ...d, commonPhrases: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Core Values</label>
              <textarea 
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[80px]"
                placeholder="What mattered most to them?"
                value={formData.values}
                onChange={e => setFormData(d => ({ ...d, values: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Cherished Memories</label>
              <textarea 
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[120px]"
                placeholder="Moments you want to hold onto..."
                value={formData.memories}
                onChange={e => setFormData(d => ({ ...d, memories: e.target.value }))}
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
                onChange={e => setFormData(d => ({ ...d, comfortLanguage: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Topics to Avoid</label>
              <textarea 
                className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[80px]"
                placeholder="Are there aspects of their life or death you aren't ready to explore?"
                value={formData.boundaries}
                onChange={e => setFormData(d => ({ ...d, boundaries: e.target.value }))}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}