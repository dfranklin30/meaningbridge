import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey, useListSafetyEvents, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Check, Shield, Users } from "lucide-react";
import { format } from "date-fns";

export default function Settings() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: profile } = useGetProfile();
  const { data: events } = useListSafetyEvents();
  const updateMe = useUpdateMe();

  const switchToProfessional = () => {
    if (updateMe.isPending) return;
    updateMe.mutate(
      { data: { role: "professional" } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMeQueryKey(), updated);
          setLocation("/caregiver");
        },
      },
    );
  };
  
  const [formData, setFormData] = useState({
    name: "",
    supportSystem: "",
    workingWithTherapist: false,
    preferredMode: "",
    consentJournal: false,
    consentContinuingBonds: false,
    safetyScreeningConsent: true,
    clinicianMonitoringConsent: false
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { mutateAsync: updateProfile } = useUpdateProfile();

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        supportSystem: profile.supportSystem || "",
        workingWithTherapist: profile.workingWithTherapist,
        preferredMode: profile.preferredMode || "",
        consentJournal: profile.consentJournal,
        consentContinuingBonds: profile.consentContinuingBonds,
        safetyScreeningConsent: profile.safetyScreeningConsent,
        clinicianMonitoringConsent: profile.clinicianMonitoringConsent
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await updateProfile({
        data: formData
      });
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return <div className="max-w-2xl mx-auto text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your preferences and safety settings.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : isSaving ? "Saving..." : "Save Preferences"}
        </button>
      </div>

      <div className="space-y-8 bg-card border border-border rounded-xl p-6 md:p-8">
        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2">Profile</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Your Name</label>
              <input 
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                value={formData.name}
                onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Support System</label>
              <input 
                className="w-full bg-background border border-border rounded-md px-4 py-2"
                placeholder="Who do you lean on?"
                value={formData.supportSystem}
                onChange={e => setFormData(d => ({ ...d, supportSystem: e.target.value }))}
              />
            </div>
          </div>
          
          <label className="flex items-center gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded text-primary focus:ring-primary"
              checked={formData.workingWithTherapist}
              onChange={e => setFormData(d => ({ ...d, workingWithTherapist: e.target.checked }))}
            />
            <span className="text-sm font-medium">I am currently working with a therapist</span>
          </label>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2">App Consents</h2>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
                checked={formData.consentJournal}
                onChange={e => setFormData(d => ({ ...d, consentJournal: e.target.checked }))}
              />
              <div>
                <span className="text-sm font-medium block">Journaling Features</span>
                <span className="text-xs text-muted-foreground block mt-1">Allow the companion AI to reference your past journal entries to provide more personalized support.</span>
              </div>
            </label>
            
            <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
                checked={formData.consentContinuingBonds}
                onChange={e => setFormData(d => ({ ...d, consentContinuingBonds: e.target.checked }))}
              />
              <div>
                <span className="text-sm font-medium block">Continuing Bonds</span>
                <span className="text-xs text-muted-foreground block mt-1">Allow the companion to use the deceased profile information to help maintain a sense of connection.</span>
              </div>
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2">Safety and Care</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
                checked={formData.safetyScreeningConsent}
                onChange={e => setFormData(d => ({ ...d, safetyScreeningConsent: e.target.checked }))}
              />
              <div>
                <span className="text-sm font-medium block">Gentle safety awareness</span>
                <span className="text-xs text-muted-foreground block mt-1">As you write, MeaningBridge quietly notices language that suggests you may be in danger, so it can offer support at the right moment. You are never shown a score.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
                checked={formData.clinicianMonitoringConsent}
                onChange={e => setFormData(d => ({ ...d, clinicianMonitoringConsent: e.target.checked }))}
              />
              <div>
                <span className="text-sm font-medium block">Let my care team be notified in serious moments</span>
                <span className="text-xs text-muted-foreground block mt-1">If you are working with a therapist, you can allow MeaningBridge to let them know when it detects serious risk, so a real person can reach out. This is optional and off unless you turn it on.</span>
              </div>
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-muted-foreground" /> Safety Events
          </h2>
          <p className="text-sm text-muted-foreground">A log of moments when the app detected potential elevated distress.</p>
          
          {events?.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">No safety events recorded.</div>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border">
              {events?.map(event => (
                <div key={event.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium ${
                        event.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                        event.severity === 'warning' ? 'bg-orange-500/10 text-orange-600' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {event.severity}
                      </span>
                      <span className="text-sm font-medium capitalize">{event.source}</span>
                    </div>
                    {event.note && <p className="text-xs text-muted-foreground mt-2">{event.note}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(event.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-serif border-b border-border/50 pb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" /> Professional portal
          </h2>
          <p className="text-sm text-muted-foreground">
            If you are a clinician, you can switch to the professional portal to see the care-team
            view. You can return to the grieving experience from there at any time.
          </p>
          <button
            type="button"
            onClick={switchToProfessional}
            disabled={updateMe.isPending}
            className="inline-flex items-center gap-2 border border-border rounded-md px-4 py-2 text-sm font-medium hover:border-foreground disabled:opacity-60 transition-colors"
          >
            <Users className="w-4 h-4" />
            {updateMe.isPending ? "Switching..." : "Switch to professional portal"}
          </button>
          {updateMe.isError && (
            <p className="text-sm text-destructive">Could not switch right now. Please try again.</p>
          )}
        </section>
      </div>
    </div>
  );
}