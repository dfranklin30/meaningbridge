import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCheckIn, getListCheckInsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { VoiceInput } from "../components/voice-input";

function ScaleSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-base font-serif text-primary tabular-nums" aria-hidden="true">
          {value}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-primary"
        aria-label={`${label}, ${value} out of 10`}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>10</span>
      </div>
    </div>
  );
}

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

  const { mutateAsync: createCheckIn, isPending } = useCreateCheckIn();

  const handleSubmit = async () => {
    try {
      await createCheckIn({
        data: { distress, meaning, connection, functioning, safetyConcern, note }
      });
      queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() });
      setSubmitted(true);
      setTimeout(() => setLocation("/app"), 3000);
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
        <ScaleSlider label="Level of distress or pain" value={distress} onChange={setDistress} />
        <ScaleSlider label="Sense of meaning or coherence" value={meaning} onChange={setMeaning} />
        <ScaleSlider
          label="Feeling of connection to your loved one"
          value={connection}
          onChange={setConnection}
        />
        <ScaleSlider label="Ability to function today" value={functioning} onChange={setFunctioning} />

        <div className="space-y-3 pt-4 border-t border-border">
          <textarea
            className="w-full bg-background border border-border rounded-md px-4 py-3 min-h-[100px]"
            placeholder="Any notes about today? (Optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <VoiceInput
              onTranscript={(text) =>
                setNote((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
              }
            />
            <p className="text-xs text-muted-foreground">
              You can speak your note and review it here before saving.
            </p>
          </div>
        </div>

        <button
          className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? "Saving" : "Save Check-in"}
        </button>
      </div>
    </div>
  );
}
