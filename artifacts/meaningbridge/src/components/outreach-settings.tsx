import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOutreachPreferences,
  useUpdateOutreachPreferences,
  getGetOutreachPreferencesQueryKey,
} from "@workspace/api-client-react";
import { Mail, Save, Check } from "lucide-react";

const CADENCE_OPTIONS = [
  { value: 3, label: "Every few days" },
  { value: 7, label: "Once a week" },
  { value: 14, label: "Every two weeks" },
  { value: 30, label: "Once a month" },
];

function hourLabel(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:00 ${period}`;
}

// Lets a grieving person shape when — and whether — the companion reaches out by
// email. Quiet hours and a pause switch keep the person in control of the cadence.
export function OutreachSettings() {
  const queryClient = useQueryClient();
  const { data: prefs } = useGetOutreachPreferences({
    query: { queryKey: getGetOutreachPreferencesQueryKey() },
  });
  const { mutateAsync: updatePrefs } = useUpdateOutreachPreferences();

  const [form, setForm] = useState({
    checkinsEnabled: true,
    cadenceDays: 7,
    taskRemindersEnabled: true,
    quietStartHour: 21,
    quietEndHour: 8,
    timezone: "UTC",
    paused: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (prefs) {
      setForm({
        checkinsEnabled: prefs.checkinsEnabled,
        cadenceDays: prefs.cadenceDays,
        taskRemindersEnabled: prefs.taskRemindersEnabled,
        quietStartHour: prefs.quietStartHour,
        quietEndHour: prefs.quietEndHour,
        timezone: prefs.timezone,
        paused: prefs.paused,
      });
    }
  }, [prefs]);

  const save = async () => {
    setIsSaving(true);
    try {
      await updatePrefs({ data: form });
      queryClient.invalidateQueries({ queryKey: getGetOutreachPreferencesQueryKey() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const detectedTz =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-2">
        <h2 className="text-xl font-serif flex items-center gap-2">
          <Mail className="w-5 h-5 text-muted-foreground" /> Gentle check-ins
        </h2>
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-foreground disabled:opacity-60 transition-colors"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Your companion can send a quiet email from time to time — a small note to see how you are, or
        a reminder of a practice you set aside. It will never arrive during your quiet hours, and you
        can pause it whenever you need stillness.
      </p>

      <div className="space-y-3">
        <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
            checked={form.checkinsEnabled}
            onChange={(e) => setForm((f) => ({ ...f, checkinsEnabled: e.target.checked }))}
          />
          <div>
            <span className="text-sm font-medium block">Occasional check-ins by email</span>
            <span className="text-xs text-muted-foreground block mt-1">
              A warm, unhurried note to let you know this space is here for you.
            </span>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
            checked={form.taskRemindersEnabled}
            onChange={(e) => setForm((f) => ({ ...f, taskRemindersEnabled: e.target.checked }))}
          />
          <div>
            <span className="text-sm font-medium block">Reminders of practices you kept</span>
            <span className="text-xs text-muted-foreground block mt-1">
              If you set an invitation aside for later, a gentle reminder can bring it back.
            </span>
          </div>
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">How often, at most</label>
          <select
            className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm"
            value={form.cadenceDays}
            onChange={(e) => setForm((f) => ({ ...f, cadenceDays: Number(e.target.value) }))}
          >
            {CADENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Your time zone</label>
          <input
            className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm"
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
          {detectedTz && detectedTz !== form.timezone && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, timezone: detectedTz }))}
              className="text-xs text-primary hover:underline underline-offset-4"
            >
              Use my device time zone ({detectedTz})
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Quiet hours begin</label>
          <select
            className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm"
            value={form.quietStartHour}
            onChange={(e) => setForm((f) => ({ ...f, quietStartHour: Number(e.target.value) }))}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Quiet hours end</label>
          <select
            className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm"
            value={form.quietEndHour}
            onChange={(e) => setForm((f) => ({ ...f, quietEndHour: Number(e.target.value) }))}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
        <input
          type="checkbox"
          className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
          checked={form.paused}
          onChange={(e) => setForm((f) => ({ ...f, paused: e.target.checked }))}
        />
        <div>
          <span className="text-sm font-medium block">Pause all outreach for now</span>
          <span className="text-xs text-muted-foreground block mt-1">
            Nothing will be sent until you turn this off. Your other choices are kept.
          </span>
        </div>
      </label>
    </section>
  );
}
