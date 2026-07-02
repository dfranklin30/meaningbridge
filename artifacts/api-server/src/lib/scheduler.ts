import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import {
  db,
  outreachPreferencesTable,
  outreachLogTable,
  companionTasksTable,
  appointmentsTable,
  patientsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { deliverOutreach } from "./outreachChannel";
import { appOriginStatic } from "./appUrl";
import { decryptPhi } from "./phi";

/**
 * In-process outreach scheduler. Runs a lightweight tick on an interval and
 * sends, within each person's own bounds (cadence, quiet hours, pause switch):
 *   - gentle companion check-ins,
 *   - reminders for active companion tasks that have a due date,
 *   - reminders for confirmed appointments in the next 24 hours.
 *
 * Idempotency: every send is guarded by a UNIQUE dedupeKey inserted into
 * `outreach_log` BEFORE sending (insert-then-send). A restart or overlapping
 * tick can therefore never double-message someone.
 */

const TICK_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

export function startOutreachScheduler(): void {
  if (timer) return;
  // Run once shortly after boot, then on the interval.
  setTimeout(() => void runOutreachTick(), 30 * 1000);
  timer = setInterval(() => void runOutreachTick(), TICK_MS);
  logger.info({ tickMs: TICK_MS }, "outreach scheduler started");
}

export async function runOutreachTick(): Promise<void> {
  const now = new Date();
  try {
    await runCheckins(now);
  } catch (err) {
    logger.error({ err: errMsg(err) }, "outreach checkins tick failed");
  }
  try {
    await runTaskReminders(now);
  } catch (err) {
    logger.error({ err: errMsg(err) }, "outreach task reminders tick failed");
  }
  try {
    await runAppointmentReminders(now);
  } catch (err) {
    logger.error({ err: errMsg(err) }, "outreach appointment reminders tick failed");
  }
}

// --- check-ins -------------------------------------------------------------

async function runCheckins(now: Date): Promise<void> {
  const prefs = await db
    .select()
    .from(outreachPreferencesTable)
    .where(
      and(
        eq(outreachPreferencesTable.checkinsEnabled, true),
        eq(outreachPreferencesTable.paused, false),
      ),
    );

  for (const pref of prefs) {
    const hour = localHour(pref.timezone, now);
    if (inQuietHours(hour, pref.quietStartHour, pref.quietEndHour)) continue;
    if (pref.lastCheckinAt) {
      const elapsedDays = (now.getTime() - pref.lastCheckinAt.getTime()) / DAY_MS;
      if (elapsedDays < pref.cadenceDays) continue;
    }

    const dedupeKey = `checkin:${pref.userId}:${localDateKey(pref.timezone, now)}`;
    if (!(await claim(pref.userId, "checkin", dedupeKey, pref.channel))) continue;

    const [user] = await db
      .select({ email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.id, pref.userId))
      .limit(1);
    if (!user?.email) {
      await markLog(dedupeKey, "skipped", "no email on file");
      continue;
    }

    const origin = appOriginStatic();
    const message = checkinEmail(user.firstName, origin);
    const result = await deliverOutreach({ channel: pref.channel, to: user.email, ...message });
    if (result.delivered) {
      await db
        .update(outreachPreferencesTable)
        .set({ lastCheckinAt: now })
        .where(eq(outreachPreferencesTable.id, pref.id));
    } else {
      await markLog(dedupeKey, "failed", result.error);
    }
  }
}

// --- task reminders --------------------------------------------------------

async function runTaskReminders(now: Date): Promise<void> {
  const soon = new Date(now.getTime() + DAY_MS);
  const tasks = await db
    .select()
    .from(companionTasksTable)
    .where(
      and(
        eq(companionTasksTable.status, "active"),
        isNotNull(companionTasksTable.dueAt),
        lte(companionTasksTable.dueAt, soon),
      ),
    );

  const prefsCache = new Map<number, typeof outreachPreferencesTable.$inferSelect | null>();

  for (const task of tasks) {
    if (task.lastRemindedAt) continue; // one gentle reminder per task
    let pref = prefsCache.get(task.userId);
    if (pref === undefined) {
      const [p] = await db
        .select()
        .from(outreachPreferencesTable)
        .where(eq(outreachPreferencesTable.userId, task.userId))
        .limit(1);
      pref = p ?? null;
      prefsCache.set(task.userId, pref);
    }
    if (!pref || pref.paused || !pref.taskRemindersEnabled) continue;
    const hour = localHour(pref.timezone, now);
    if (inQuietHours(hour, pref.quietStartHour, pref.quietEndHour)) continue;

    const dedupeKey = `task_reminder:${task.id}`;
    if (!(await claim(task.userId, "task_reminder", dedupeKey, pref.channel))) continue;

    const [user] = await db
      .select({ email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable)
      .where(eq(usersTable.id, task.userId))
      .limit(1);
    if (!user?.email) {
      await markLog(dedupeKey, "skipped", "no email on file");
      continue;
    }

    const origin = appOriginStatic();
    const message = taskReminderEmail(user.firstName, task.title, origin);
    const result = await deliverOutreach({ channel: pref.channel, to: user.email, ...message });
    if (result.delivered) {
      await db
        .update(companionTasksTable)
        .set({ lastRemindedAt: now })
        .where(eq(companionTasksTable.id, task.id));
    } else {
      await markLog(dedupeKey, "failed", result.error);
    }
  }
}

// --- appointment reminders -------------------------------------------------

async function runAppointmentReminders(now: Date): Promise<void> {
  const soon = new Date(now.getTime() + DAY_MS);
  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.status, "confirmed"),
        gte(appointmentsTable.startsAt, now),
        lte(appointmentsTable.startsAt, soon),
      ),
    );

  for (const appt of appts) {
    if (appt.lastReminderAt) continue;
    const [patient] = await db
      .select({ emailEnc: patientsTable.emailEnc, firstNameEnc: patientsTable.firstNameEnc })
      .from(patientsTable)
      .where(eq(patientsTable.id, appt.patientId))
      .limit(1);
    const email = decryptPhi(patient?.emailEnc);
    const dedupeKey = `appointment_reminder:${appt.id}`;
    if (!(await claim(appt.providerUserId, "appointment_reminder", dedupeKey, "email"))) continue;
    if (!email) {
      await markLog(dedupeKey, "skipped", "no patient email");
      continue;
    }
    const firstName = decryptPhi(patient?.firstNameEnc);
    const message = appointmentReminderEmail(firstName, appt.title, appt.startsAt, appt.location);
    const result = await deliverOutreach({ channel: "email", to: email, ...message });
    if (result.delivered) {
      await db
        .update(appointmentsTable)
        .set({ lastReminderAt: now })
        .where(eq(appointmentsTable.id, appt.id));
    } else {
      await markLog(dedupeKey, "failed", result.error);
    }
  }
}

// --- idempotency ledger ----------------------------------------------------

/** Insert the dedupeKey first; win the race only if the insert is not a conflict. */
async function claim(
  userId: number,
  kind: string,
  dedupeKey: string,
  channel: string,
): Promise<boolean> {
  const rows = await db
    .insert(outreachLogTable)
    .values({ userId, kind, dedupeKey, channel, status: "sent" })
    .onConflictDoNothing({ target: outreachLogTable.dedupeKey })
    .returning({ id: outreachLogTable.id });
  return rows.length > 0;
}

async function markLog(dedupeKey: string, status: string, detail?: string): Promise<void> {
  await db
    .update(outreachLogTable)
    .set({ status, detail: detail ?? null })
    .where(eq(outreachLogTable.dedupeKey, dedupeKey));
}

// --- time helpers ----------------------------------------------------------

function localHour(tz: string, at: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz });
    return parseInt(fmt.format(at), 10) % 24;
  } catch {
    return at.getUTCHours();
  }
}

function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // window wraps midnight
}

function localDateKey(tz: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// --- email bodies (calm, no emojis, links back into the app) ---------------

function shell(bodyHtml: string): string {
  return `<div style="font-family: Georgia, 'Times New Roman', serif; color: #22303f; line-height: 1.6; max-width: 520px;">${bodyHtml}</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin: 28px 0;"><a href="${href}" style="background:#2f8a86;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;">${label}</a></p>`;
}

function checkinEmail(firstName: string | null, origin: string) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";
  const link = `${origin}/companion`;
  const text = [
    greeting,
    "",
    "This is a gentle check-in from your MeaningBridge companion. There is nothing you need to do. If it would help to talk, or simply to sit with a thought, your companion is here whenever you are ready.",
    "",
    "Open your companion:",
    link,
    "",
    "You can change how often you hear from us, set quiet hours, or pause these messages at any time in your settings.",
    "",
    "With care,",
    "The MeaningBridge team",
  ].join("\n");
  const html = shell(
    `<p>${greeting}</p>
     <p>This is a gentle check-in from your MeaningBridge companion. There is nothing you need to do. If it would help to talk, or simply to sit with a thought, your companion is here whenever you are ready.</p>
     ${button(link, "Open your companion")}
     <p style="color:#5b6b78;font-size:14px;">You can change how often you hear from us, set quiet hours, or pause these messages at any time in your settings.</p>
     <p style="margin-top:28px;">With care,<br/>The MeaningBridge team</p>`,
  );
  return { subject: "A gentle check-in from MeaningBridge", text, html };
}

function taskReminderEmail(firstName: string | null, title: string, origin: string) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";
  const link = `${origin}/companion`;
  const text = [
    greeting,
    "",
    `A little while ago you set aside something to return to: "${title}". There is no pressure and no schedule to keep — this is only here if it feels right today.`,
    "",
    "Return to it here:",
    link,
    "",
    "With care,",
    "The MeaningBridge team",
  ].join("\n");
  const html = shell(
    `<p>${greeting}</p>
     <p>A little while ago you set aside something to return to: <em>${escapeHtml(title)}</em>. There is no pressure and no schedule to keep &mdash; this is only here if it feels right today.</p>
     ${button(link, "Return to it")}
     <p style="margin-top:28px;">With care,<br/>The MeaningBridge team</p>`,
  );
  return { subject: "A gentle reminder from MeaningBridge", text, html };
}

function appointmentReminderEmail(
  firstName: string | null,
  title: string,
  startsAt: Date,
  location: string | null,
) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";
  const when = startsAt.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const locationLine = location ? `\nWhere: ${location}` : "";
  const text = [
    greeting,
    "",
    `This is a reminder of your upcoming session: "${title}".`,
    `When: ${when}${locationLine}`,
    "",
    "With care,",
    "The MeaningBridge team",
  ].join("\n");
  const html = shell(
    `<p>${greeting}</p>
     <p>This is a reminder of your upcoming session: <em>${escapeHtml(title)}</em>.</p>
     <p><strong>When:</strong> ${escapeHtml(when)}${location ? `<br/><strong>Where:</strong> ${escapeHtml(location)}` : ""}</p>
     <p style="margin-top:28px;">With care,<br/>The MeaningBridge team</p>`,
  );
  return { subject: "A reminder of your upcoming session", text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
