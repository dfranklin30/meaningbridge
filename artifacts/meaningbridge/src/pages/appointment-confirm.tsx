import { useState } from "react";
import { useRoute } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAppointmentByToken,
  useRespondToAppointment,
  getGetAppointmentByTokenQueryKey,
} from "@workspace/api-client-react";
import { CalendarClock, MapPin, Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

function fmtRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const date = start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = Number.isNaN(end.getTime())
    ? ""
    : end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return endTime ? `${date}, ${startTime} – ${endTime}` : `${date}, ${startTime}`;
}

export default function AppointmentConfirm() {
  const [, params] = useRoute("/appointments/:token");
  const token = params?.token ?? "";
  const {
    data: appointment,
    isLoading,
    isError,
  } = useGetAppointmentByToken(token, {
    query: { queryKey: getGetAppointmentByTokenQueryKey(token), enabled: !!token },
  });
  const { mutateAsync: respond, isPending } = useRespondToAppointment();
  const queryClient = useQueryClient();
  // Server-returned status after responding. We trust the server's truth (the
  // token may already have been resolved) rather than the button the patient
  // clicked, so the outcome shown always matches what was actually recorded.
  const [resolvedStatus, setResolvedStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "confirm" | "decline") => {
    if (isPending) return;
    setError(null);
    try {
      const updated = await respond({ token, data: { decision } });
      setResolvedStatus(updated?.status ?? null);
      queryClient.invalidateQueries({
        queryKey: getGetAppointmentByTokenQueryKey(token),
      });
    } catch {
      setError("We could not record your response. Please try again in a moment.");
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-[100dvh] bg-background font-sans text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo variant="lockup" size={40} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6"
      >
        {children}
      </motion.div>
    </div>
  );

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (isError || !appointment) {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <h1 className="font-serif text-xl">This link is no longer active</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The appointment may have already been answered, or the link has expired. If you have
            questions, please reply to the email your care team sent you.
          </p>
        </div>
      </Shell>
    );
  }

  const effectiveStatus = resolvedStatus ?? appointment.status;
  const alreadyResolved =
    effectiveStatus === "confirmed" ||
    effectiveStatus === "declined" ||
    effectiveStatus === "cancelled";
  const outcome =
    effectiveStatus === "confirmed"
      ? "confirm"
      : effectiveStatus === "declined"
        ? "decline"
        : null;

  return (
    <Shell>
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-2xl">{appointment.title}</h1>
        {appointment.providerName && (
          <p className="text-sm text-muted-foreground">with {appointment.providerName}</p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-background px-4 py-4 text-sm">
        <div className="flex items-start gap-3">
          <CalendarClock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span>{fmtRange(appointment.startsAt, appointment.endsAt)}</span>
        </div>
        {appointment.location && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>{appointment.location}</span>
          </div>
        )}
      </div>

      {outcome === "confirm" ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <Check className="w-4 h-4 shrink-0" />
          <span>You are confirmed. Your care team has been notified.</span>
        </div>
      ) : outcome === "decline" ? (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          You have let your care team know this time does not work. They will be in touch about
          another.
        </div>
      ) : effectiveStatus === "cancelled" ? (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          This appointment has been cancelled by your care team.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Does this time work for you?
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => decide("confirm")}
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Yes, confirm
            </button>
            <button
              type="button"
              onClick={() => decide("decline")}
              disabled={isPending}
              className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium hover:border-foreground disabled:opacity-50 transition-colors"
            >
              This time does not work
            </button>
          </div>
          {alreadyResolved && (
            <p className="text-xs text-muted-foreground text-center">
              This appointment has already been answered.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </Shell>
  );
}
