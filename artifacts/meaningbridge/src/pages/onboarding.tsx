import { useState } from "react";
import { useLocation } from "wouter";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey, useCreateDeceasedProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile } = useGetProfile();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    deceasedName: "",
    relationship: "",
    lossDate: "",
    lossType: "",
    preferredMode: "continuing-bonds",
    consentJournal: true,
    consentContinuingBonds: true,
  });

  const { mutateAsync: updateProfile } = useUpdateProfile();
  const { mutateAsync: createDeceased } = useCreateDeceasedProfile();

  const handleNext = () => setStep(s => s + 1);
  
  const handleSubmit = async () => {
    try {
      await updateProfile({
        data: {
          name: formData.name,
          preferredMode: formData.preferredMode,
          consentJournal: formData.consentJournal,
          consentContinuingBonds: formData.consentContinuingBonds,
          onboardingComplete: true,
          crisisAcknowledged: true
        }
      });
      
      await createDeceased({
        data: {
          name: formData.deceasedName,
          relationship: formData.relationship,
          lossDate: formData.lossDate,
          lossType: formData.lossType,
        }
      });
      
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      setLocation("/app");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif">Welcome to MeaningBridge</h1>
        <p className="text-muted-foreground">A gentle space for your grief.</p>
      </div>

      <motion.div 
        key={step}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border p-6 rounded-xl shadow-sm"
      >
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-serif">First, what should we call you?</h2>
            <input 
              className="w-full bg-background border border-border rounded-md px-4 py-2"
              value={formData.name}
              onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
              placeholder="Your name"
            />
            <button 
              className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium"
              onClick={handleNext}
              disabled={!formData.name}
            >
              Continue
            </button>
          </div>
        )}
        
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-serif">Who are you carrying in your heart?</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Their name</label>
                <input 
                  className="w-full bg-background border border-border rounded-md px-4 py-2"
                  value={formData.deceasedName}
                  onChange={e => setFormData(d => ({ ...d, deceasedName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Relationship to you</label>
                <input 
                  className="w-full bg-background border border-border rounded-md px-4 py-2"
                  value={formData.relationship}
                  onChange={e => setFormData(d => ({ ...d, relationship: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                className="w-1/3 bg-secondary text-secondary-foreground py-2 rounded-md"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button 
                className="w-2/3 bg-primary text-primary-foreground py-2 rounded-md font-medium"
                onClick={handleNext}
                disabled={!formData.deceasedName || !formData.relationship}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-serif">A note on safety</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This space is for reflection and continuing bonds. It is not a substitute for clinical care.
              If you are in immediate danger or experiencing a crisis, please reach out to emergency services.
            </p>
            <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-md">
              <p className="text-sm font-medium text-destructive">You can always find crisis resources via the link in the top right corner.</p>
            </div>
            <div className="flex gap-4">
              <button 
                className="w-1/3 bg-secondary text-secondary-foreground py-2 rounded-md"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button 
                className="w-2/3 bg-primary text-primary-foreground py-2 rounded-md font-medium"
                onClick={handleSubmit}
              >
                I understand
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}