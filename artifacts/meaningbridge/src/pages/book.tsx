import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { Loader2, ArrowLeft, Calendar, Clock, Check } from "lucide-react";
import {
  useGetBookingEligibility,
  useListBookingAppointmentTypes,
  getListBookingAppointmentTypesQueryKey,
  useListBookingAvailableSlots,
  getListBookingAvailableSlotsQueryKey,
  useCreateBooking,
  useGetMe,
  type BookingAppointmentType,
  type BookingSlot,
  type BookedAppointment,
} from "@workspace/api-client-react";

// The clinician to book with. Comes from a ?providerId= link (a matched
// clinician) or an environment default; there is no arbitrary provider picker.
function useProviderId(): string | null {
  return useMemo(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("providerId");
    const fromEnv = import.meta.env.VITE_HEALTHIE_DEFAULT_PROVIDER_ID as
      | string
      | undefined;
    return (fromQuery || fromEnv || "").trim() || null;
  }, []);
}

const localTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Step = "type" | "slot" | "details";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-serif text-foreground">Book a session</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Choose a time to meet with your clinician. Everything here is held in
          confidence.
        </p>
      </div>
      {children}
    </div>
  );
}

function CalmNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/50 border border-border rounded-xl p-8 text-center space-y-4">
      <p className="font-serif text-xl text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        {body}
      </p>
      {action}
    </div>
  );
}

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

export default function Book() {
  const providerId = useProviderId();
  const { data: me } = useGetMe();

  const eligibility = useGetBookingEligibility();

  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<BookingAppointmentType | null>(
    null,
  );
  const [contactType, setContactType] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [booked, setBooked] = useState<BookedAppointment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const allowed = eligibility.data?.allowed === true;

  const typesParams = { providerId: providerId ?? "" };
  const typesQuery = useListBookingAppointmentTypes(typesParams, {
    query: {
      enabled: !!providerId && allowed,
      queryKey: getListBookingAppointmentTypesQueryKey(typesParams),
    },
  });

  const slotsParams = {
    providerId: providerId ?? "",
    appointmentTypeId: selectedType?.id ?? "",
    contactType,
    date,
    timezone: localTimezone,
  };
  const slotsQuery = useListBookingAvailableSlots(slotsParams, {
    query: {
      enabled: step === "slot" && !!selectedType && !!contactType,
      queryKey: getListBookingAvailableSlotsQueryKey(slotsParams),
    },
  });

  const createBooking = useCreateBooking();

  // --- Guard states --------------------------------------------------------

  if (!providerId) {
    return (
      <Shell>
        <CalmNotice
          title="No clinician selected"
          body="Open the booking link your clinician shared with you, and we will bring you straight to their availability."
          action={
            <Link
              href="/therapists"
              className="inline-block text-sm text-primary hover:underline underline-offset-4"
            >
              Find a clinician
            </Link>
          }
        />
      </Shell>
    );
  }

  if (eligibility.isLoading) {
    return (
      <Shell>
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (!allowed) {
    const reason = eligibility.data?.reason;
    if (reason === "not_configured") {
      return (
        <Shell>
          <CalmNotice
            title="Scheduling is not available yet"
            body="Online booking is being set up. Please check back soon, or reach out to your clinician directly."
          />
        </Shell>
      );
    }
    if (reason === "not_linked") {
      return (
        <Shell>
          <CalmNotice
            title="We are finishing your setup"
            body="Your account is still being connected to scheduling. This usually takes only a short while."
            action={
              <Link
                href="/app"
                className="inline-block text-sm text-primary hover:underline underline-offset-4"
              >
                Return home
              </Link>
            }
          />
        </Shell>
      );
    }
    return (
      <Shell>
        <CalmNotice
          title="A few things first"
          body="Please complete your intake and consent forms before booking your first session. Once they are signed, this page will open up."
          action={
            <Link
              href="/care/connect"
              className="inline-block text-sm text-primary hover:underline underline-offset-4"
            >
              Continue setup
            </Link>
          }
        />
      </Shell>
    );
  }

  // --- Confirmation --------------------------------------------------------

  if (booked) {
    return (
      <Shell>
        <motion.div {...fade} className="bg-card border border-border rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <p className="font-serif text-xl text-foreground">Your session is booked</p>
              <p className="text-sm text-muted-foreground">
                A confirmation has been sent to your email.
              </p>
            </div>
          </div>
          <dl className="text-sm space-y-2">
            {booked.appointmentTypeName && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Session</dt>
                <dd className="text-foreground">{booked.appointmentTypeName}</dd>
              </div>
            )}
            {(booked.start || booked.date) && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">When</dt>
                <dd className="text-foreground">
                  {new Date(booked.start || booked.date || "").toLocaleString()}
                </dd>
              </div>
            )}
            {booked.providerName && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">With</dt>
                <dd className="text-foreground">{booked.providerName}</dd>
              </div>
            )}
          </dl>
          {booked.addToGcalLink && (
            <a
              href={booked.addToGcalLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4"
            >
              <Calendar className="h-4 w-4" /> Add to calendar
            </a>
          )}
        </motion.div>
      </Shell>
    );
  }

  // --- Wizard --------------------------------------------------------------

  const stepIndex = step === "type" ? 0 : step === "slot" ? 1 : 2;

  return (
    <Shell>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["Session type", "Time", "Your details"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={
                i <= stepIndex ? "text-foreground font-medium" : "text-muted-foreground"
              }
            >
              {label}
            </span>
            {i < 2 && <span className="text-border">/</span>}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === "type" && (
          <motion.div key="type" {...fade} className="space-y-4">
            {typesQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : typesQuery.isError ? (
              <CalmNotice
                title="We could not load session types"
                body="Please try again in a moment."
              />
            ) : (typesQuery.data ?? []).length === 0 ? (
              <CalmNotice
                title="No session types available"
                body="Your clinician has not published any bookable sessions yet."
              />
            ) : (
              <div className="grid gap-4">
                {(typesQuery.data ?? []).map((t) => {
                  const isSelected = selectedType?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(t);
                        setContactType(t.contactTypes[0] ?? "");
                      }}
                      className={`text-left bg-card border rounded-xl p-5 transition-colors ${
                        isSelected
                          ? "border-primary ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-serif text-lg text-foreground">
                          {t.name}
                        </span>
                        {t.length != null && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="h-3.5 w-3.5" /> {t.length} min
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedType && selectedType.contactTypes.length > 1 && (
              <div className="space-y-2 pt-2">
                <p className="text-sm text-muted-foreground">How would you like to meet?</p>
                <div className="flex flex-wrap gap-2">
                  {selectedType.contactTypes.map((ct) => (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => setContactType(ct)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        contactType === ct
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {ct.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedType && contactType && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlot(null);
                    setStep("slot");
                  }}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === "slot" && (
          <motion.div key="slot" {...fade} className="space-y-5">
            <button
              type="button"
              onClick={() => setStep("type")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Session type
            </button>

            <div className="flex items-center gap-3">
              <label htmlFor="book-date" className="text-sm text-muted-foreground">
                Date
              </label>
              <input
                id="book-date"
                type="date"
                min={todayIso()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelectedSlot(null);
                }}
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
              />
            </div>

            {slotsQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : slotsQuery.isError ? (
              <CalmNotice
                title="We could not load available times"
                body="Please try another date, or come back in a moment."
              />
            ) : (
              (() => {
                const open = (slotsQuery.data ?? []).filter((s) => !s.isFullyBooked);
                if (open.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No open times on this day. Please try another date.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {open.map((s) => {
                      const isSelected = selectedSlot?.date === s.date;
                      return (
                        <button
                          key={s.date}
                          type="button"
                          onClick={() => setSelectedSlot(s)}
                          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-foreground hover:border-foreground/30"
                          }`}
                        >
                          {new Date(s.date).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            )}

            {selectedSlot && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setStep("details");
                  }}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === "details" && selectedType && selectedSlot && (
          <motion.div key="details" {...fade} className="space-y-5">
            <button
              type="button"
              onClick={() => setStep("slot")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Time
            </button>

            <div className="bg-muted/40 border border-border rounded-lg p-4 text-sm text-muted-foreground">
              {selectedType.name} — {new Date(selectedSlot.date).toLocaleString()}
            </div>

            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setFormError(null);
                const fd = new FormData(e.currentTarget);
                try {
                  const result = await createBooking.mutateAsync({
                    data: {
                      providerId,
                      appointmentTypeId: selectedType.id,
                      contactType,
                      date: selectedSlot.date,
                      firstName: String(fd.get("firstName") ?? "").trim(),
                      lastName: String(fd.get("lastName") ?? "").trim(),
                      email: String(fd.get("email") ?? "").trim(),
                      phoneNumber: String(fd.get("phoneNumber") ?? "").trim(),
                      timezone: localTimezone,
                    },
                  });
                  setBooked(result);
                } catch (err) {
                  const data = (err as { data?: unknown } | null)?.data;
                  const message =
                    data && typeof data === "object" && "error" in data
                      ? String((data as { error: unknown }).error)
                      : "We could not complete your booking. Please try again.";
                  setFormError(message);
                }
              }}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="firstName" className="text-sm text-foreground">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    required
                    defaultValue={me?.firstName ?? ""}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="lastName" className="text-sm text-foreground">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    required
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={me?.email ?? ""}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="phoneNumber" className="text-sm text-foreground">
                  Phone
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  required
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50 outline-none"
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={createBooking.isPending}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {createBooking.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Confirm booking
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
