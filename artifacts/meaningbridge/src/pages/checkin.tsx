import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCheckIn, getListCheckInsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function CheckIn() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [distress, setDistress] = useState(5);
  const [meaning, setMeaning] = useState(5);
  const [connection, setConnection] = useState(5);
  const [functioning, setFunctioning] = useState(5);
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [note, setNote] = useState("");
  
  const [submitted, setSubmitted] = useState(false);

  const { mutateAsync: createCheckIn } = useCreateCheckIn();

  const handleSubmit = async () => {
    try {
      await createCheckIn({
        data: { distress, meaning, connection, functioning, safetyConcern, note }
      });
      queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() });
      setSubmitted(true);
      setTimeout(() => setLocation("/"), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-6">
        <h2 className="text-2xl font-serif">Thank you for checking in.</h2>
        <p className="text-muted-foreground">Taking time to notice where you are is an act of gentleness.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif">Check-in</h1>
        <p className="text-muted-foreground">Notice how you're feeling right now, without judgment.</p>
      </div>

      <div className="bg-card border border-border p-6 rounded-xl space-y-8">
        <div className="space-y-4">
          <label className="block text-sm font-medium">Level of distress or pain</label>
          <input type="range" min="0" max="10" value={distress} onChange={(e) => setDistress(parseInt(e.target.value))} className="w-full accent-primary" />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium">Sense of meaning or coherence</label>
          <input type="range" min="0" max="10" value={meaning} onChange={(e) => setMeaning(parseInt(e.target.value))} className="w-full accent-primary" />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium">Feeling of connection to your loved one</label>
          <input type="range" min="0" max="10" value={connection} onChange={(e) => setConnection(parseInt(e.target.value))} className="w-full accent-primary" />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium">Ability to function today</label>
          <input type="range" min="0" max="10" value={functioning} onChange={(e) => setFunctioning(parseInt(e.target.value))} className="w-full accent-primary" />
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <textarea 
            className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[100px]"
            placeholder="Any notes about today? (Optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        
        <button 
          className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium"
          onClick={handleSubmit}
        >
          Save Check-in
        </button>
      </div>
    </div>
  );
}