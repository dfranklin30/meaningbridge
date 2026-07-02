import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOutreachPreferences,
  useUpdateOutreachPreferences,
  useStartPhoneVerification,
  useConfirmPhoneVerification,
  useRemoveOutreachPhone,
  getGetOutreachPreferencesQueryKey,
} from "@workspace/api-client-react";
import { Mail, MessageSquare, Save, Check } from "lucide-react";

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

// Lets a grieving person shape when — and how — the companion reaches out, by
// a quiet email or a text message. Quiet hours and a pause switch keep the
// person in control of the cadence. Text messages require a verified number so
// nothing is ever sent to a number the person did not confirm.
export function OutreachSettings() {
  const queryClient = useQueryClient();
  const { data: prefs } = useGetOutreachPreferences({
    query: { queryKey: getGetOutreachPreferencesQueryKey() },
  });
  const { mutateAsync: updatePrefs } = useUpdateOutreachPreferences();
  const { mutateAsync: startVerification, isPending: isStarting } = useStartPhoneVerification();
  const { mutateAsync: confirmVerification, isPending: isConfirming } = useConfirmPhoneVerification();
  const { mutateAsync: removePhone, isPending: isRemoving } = useRemoveOutreachPhone();

  const [form, setForm] = useState({
    checkinsEnabled: true,
    cadenceDays: 7,
    taskRemindersEnabled: true,
    quietStartHour: 21,
    quietEndHour: 8,
    timezone: "UTC",
    channel: "email" as "email" | "sms",
    paused: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Phone verification local state.
  const [phoneInput, setPhoneInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (prefs) {
      setForm({
        checkinsEnabled: prefs.checkinsEnabled,
        cadenceDays: prefs.cadenceDays,
        taskRemindersEnabled: prefs.taskRemindersEnabled,
        quietStartHour: prefs.quietStartHour,
        quietEndHour: prefs.quietEndHour,
        timezone: prefs.timezone,
        channel: prefs.channel === "sms" ? "sms" : "email",
        paused: prefs.paused,
      });
    }
  }, [prefs]);

  const phoneVerified = Boolean(prefs?.phoneVerified);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetOutreachPreferencesQueryKey() });

  const save = async () => {
    setSaveError(null);
    // Guard in the UI too: text delivery needs a verified number.
    if (form.channel === "sms" && !phoneVerified) {
      setSaveError("Verify a mobile number below before choosing text messages.");
      return;
    }
    setIsSaving(true);
    try {
      await updatePrefs({ data: form });
      invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Could not save right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const sendCode = async () => {
    setPhoneError(null);
    setPhoneMessage(null);
    try {
      const res = await startVerification({ data: { phone: phoneInput } });
      setAwaitingCode(true);
      invalidate();
      if (res.sent) {
        setPhoneMessage(`We sent a code to ${res.pendingPhone}. Enter it below to confirm.`);
      } else {
        setPhoneMessage(
          "Text messaging is not fully set up yet, so the code could not be sent. Once it is configured, this step will work.",
        );
      }
    } catch {
      setPhoneError("That does not look like a mobile number we can reach. Please check it.");
    }
  };

  const confirmCode = async () => {
    setPhoneError(null);
    setPhoneMessage(null);
    try {
      await confirmVerification({ data: { code: codeInput } });
      invalidate();
      setAwaitingCode(false);
      setCodeInput("");
      setPhoneInput("");
      setPhoneMessage("Your number is verified. You can now receive check-ins by text.");
    } catch {
      setPhoneError("That code did not match or has expired. Please try again.");
    }
  };

  const forgetNumber = async () => {
    setPhoneError(null);
    setPhoneMessage(null);
    try {
      await removePhone();
      invalidate();
      setForm((f) => ({ ...f, channel: "email" }));
      setAwaitingCode(false);
      setCodeInput("");
      setPhoneInput("");
    } catch {
      setPhoneError("Could not remove the number right now. Please try again.");
    }
  };

  const detectedTz =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  const channelNoun = form.channel === "sms" ? "text message" : "email";

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
        Your companion can reach out from time to time by {channelNoun} — a small note to see how you
        are, or a reminder of a practice you set aside. It will never arrive during your quiet hours,
        and you can pause it whenever you need stillness.
      </p>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div className="space-y-3">
        <label className="flex items-start gap-3 p-4 border border-border rounded-md cursor-pointer hover:bg-secondary/10 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-primary focus:ring-primary mt-1"
            checked={form.checkinsEnabled}
            onChange={(e) => setForm((f) => ({ ...f, checkinsEnabled: e.target.checked }))}
          />
          <div>
            <span className="text-sm font-medium block">Occasional check-ins</span>
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

      <div className="space-y-3">
        <span className="text-sm font-medium text-muted-foreground">How you would like to hear from us</span>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, channel: "email" }))}
            className={`flex items-center gap-3 p-4 border rounded-md text-left transition-colors ${
              form.channel === "email"
                ? "border-foreground bg-secondary/10"
                : "border-border hover:bg-secondary/10"
            }`}
          >
            <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <span className="text-sm font-medium block">Email</span>
              <span className="text-xs text-muted-foreground block mt-1">Sent to your account email.</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, channel: "sms" }))}
            className={`flex items-center gap-3 p-4 border rounded-md text-left transition-colors ${
              form.channel === "sms"
                ? "border-foreground bg-secondary/10"
                : "border-border hover:bg-secondary/10"
            }`}
          >
            <MessageSquare className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <span className="text-sm font-medium block">Text message</span>
              <span className="text-xs text-muted-foreground block mt-1">
                {phoneVerified && prefs?.phone
                  ? `Sent to ${prefs.phone}.`
                  : "Sent to a mobile number you verify below."}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Phone capture + verification. Shown whenever SMS is selected, or a
          number is already on file so it can be managed. */}
      {(form.channel === "sms" || phoneVerified) && (
        <div className="space-y-3 p-4 border border-border rounded-md bg-secondary/5">
          {phoneVerified ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                Verified: <span className="font-medium">{prefs?.phone}</span>
              </span>
              <button
                type="button"
                onClick={forgetNumber}
                disabled={isRemoving}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 disabled:opacity-60"
              >
                {isRemoving ? "Removing..." : "Remove this number"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-sm font-medium">Verify a mobile number</span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Your mobile number"
                  className="flex-1 bg-background border border-border rounded-md px-4 py-2 text-sm"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={isStarting || phoneInput.trim().length < 3}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-foreground disabled:opacity-60 transition-colors shrink-0"
                >
                  {isStarting ? "Sending..." : awaitingCode ? "Resend code" : "Send code"}
                </button>
              </div>

              {awaitingCode && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    className="flex-1 bg-background border border-border rounded-md px-4 py-2 text-sm tracking-widest"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={confirmCode}
                    disabled={isConfirming || codeInput.trim().length < 4}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-foreground disabled:opacity-60 transition-colors shrink-0"
                  >
                    {isConfirming ? "Verifying..." : "Verify"}
                  </button>
                </div>
              )}
            </div>
          )}

          {phoneMessage && <p className="text-xs text-muted-foreground">{phoneMessage}</p>}
          {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
        </div>
      )}

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
