import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useCreateCheckIn, getListCheckInsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { VoiceInput } from "../components/voice-input";

function pulseFeedback(v: {
  distress: number;
  meaning: number;
  connection: number;
  functioning: number;
  safetyConcern: boolean;
}): { lines: string[]; showSupport: boolean } {
  const lines: string[] = [];
  const showSupport = v.safetyConcern || (v.distress >= 8 && v.functioning <= 3);

  if (v.distress >= 7) {
    lines.push(
      "Today carries a lot of weight. That level of pain is a real and understandable part of grieving someone who mattered.",
    );
  } else if (v.distress <= 3) {
    lines.push(
      "Today feels a little lighter. It is okay to let the steadier moments simply be what they are.",
    );
  } else {
    lines.push("Today sits somewhere in the middle — some ache, and some room to breathe.");
  }

  if (v.connection >= 6) {
    lines.push(
      "You are still feeling close to the one you are remembering. That bond continuing is not something to move past.",
    );
  }
  if (v.meaning <= 3) {
    lines.push(
      "Meaning feels hard to reach right now. It often returns slowly, in small pieces, and it does not need forcing.",
    );
  } else if (v.meaning >= 7) {
    lines.push("A sense of meaning is present today, even alongside the loss.");
  }
  if (v.functioning <= 3) {
    lines.push("Everyday tasks feel heavy. Be gentle with what you ask of yourself today.");
  }

  return { lines, showSupport };
}

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
    } catch (e) {
      console.error(e);
    }
  };

  if (submitted) {
    const fb = pulseFeedback({ distress, meaning, connection, functioning, safetyConcern });
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6">
        <div className="flex items-center">
          <Link
            href="/app"
            aria-label="Back"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-serif">Thank you for checking in.</h2>
          <p className="text-muted-foreground">
            Taking time to notice where you are is an act of gentleness.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            A gentle read on today
          </p>
          {fb.lines.map((line, i) => (
            <p key={i} className="text-sm text-foreground/90 leading-relaxed">
              {line}
            </p>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            This is a gentle reflection to sit with. You are the author of what it means.
          </p>
        </div>
        {fb.showSupport && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
            <p className="text-sm text-foreground/90 leading-relaxed mb-3">
              Today sounds especially heavy. You do not have to carry it alone — support is
              available right now.
            </p>
            <Link
              href="/crisis"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              See support options
            </Link>
          </div>
        )}
        <div className="flex justify-center gap-4 pt-2">
          <button
            onClick={() => setLocation("/dashboard")}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            See how this fits over time
          </button>
          <button
            onClick={() => setLocation("/app")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Return home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <Link
          href="/app"
          aria-label="Back"
          className="w-8 h-8 mt-1 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-serif">Check-in</h1>
          <p className="text-muted-foreground">Notice how you're feeling right now, without judgment.</p>
        </div>
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
