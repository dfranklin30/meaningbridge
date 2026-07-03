import { and, count, desc, eq } from "drizzle-orm";
import {
  db,
  type Patient,
  profileTable,
  chatSessionsTable,
  chatMessagesTable,
  journalEntriesTable,
  checkinsTable,
  safetyEventsTable,
} from "@workspace/db";
import { professionalComplete } from "./aiProvider";
import { providerAssistantSystemPrompt } from "./prompts";

/**
 * The provider assistant answers a clinician's questions about a patient from
 * ENGAGEMENT METADATA ONLY — counts, timestamps, enrollment status, and the
 * validated care tier. It never reads, quotes, or infers the patient's private
 * journal or companion content. This module builds that metadata view and runs
 * the (strictly bounded) assistant.
 */

export interface PatientEngagement {
  patientId: number;
  status: string;
  tier: string | null;
  sessionCount: number;
  lastActiveAt: string | null;
  companionMessageCount: number;
  journalEntryCount: number;
  checkinCount: number;
  lastCheckinAt: string | null;
  safetyEventCount: number;
  openSafetyEventCount: number;
  lastSafetyEventAt: string | null;
}

/** Assemble the metadata-only engagement view for a patient. No content is read. */
export async function buildPatientEngagement(patient: Patient): Promise<PatientEngagement> {
  const engagement: PatientEngagement = {
    patientId: patient.id,
    status: patient.status,
    tier: null,
    sessionCount: patient.sessionCount,
    lastActiveAt: patient.lastActiveAt ? patient.lastActiveAt.toISOString() : null,
    companionMessageCount: 0,
    journalEntryCount: 0,
    checkinCount: 0,
    lastCheckinAt: null,
    safetyEventCount: 0,
    openSafetyEventCount: 0,
    lastSafetyEventAt: null,
  };

  const linkedUserId = patient.linkedUserId;
  if (!linkedUserId) return engagement;

  const [prof] = await db
    .select({ tier: profileTable.tier })
    .from(profileTable)
    .where(eq(profileTable.userId, linkedUserId))
    .limit(1);
  engagement.tier = prof?.tier ?? null;

  const [companionMsg] = await db
    .select({ c: count() })
    .from(chatMessagesTable)
    .innerJoin(chatSessionsTable, eq(chatMessagesTable.sessionId, chatSessionsTable.id))
    .where(and(eq(chatSessionsTable.userId, linkedUserId), eq(chatMessagesTable.role, "user")));
  engagement.companionMessageCount = companionMsg?.c ?? 0;

  const [journal] = await db
    .select({ c: count() })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, linkedUserId));
  engagement.journalEntryCount = journal?.c ?? 0;

  const [checkins] = await db
    .select({ c: count() })
    .from(checkinsTable)
    .where(eq(checkinsTable.userId, linkedUserId));
  engagement.checkinCount = checkins?.c ?? 0;

  const [lastCheckin] = await db
    .select({ createdAt: checkinsTable.createdAt })
    .from(checkinsTable)
    .where(eq(checkinsTable.userId, linkedUserId))
    .orderBy(desc(checkinsTable.createdAt))
    .limit(1);
  engagement.lastCheckinAt = lastCheckin?.createdAt ? lastCheckin.createdAt.toISOString() : null;

  const [safety] = await db
    .select({ c: count() })
    .from(safetyEventsTable)
    .where(eq(safetyEventsTable.userId, linkedUserId));
  engagement.safetyEventCount = safety?.c ?? 0;

  const [openSafety] = await db
    .select({ c: count() })
    .from(safetyEventsTable)
    .where(and(eq(safetyEventsTable.userId, linkedUserId), eq(safetyEventsTable.acknowledged, false)));
  engagement.openSafetyEventCount = openSafety?.c ?? 0;

  const [lastSafety] = await db
    .select({ createdAt: safetyEventsTable.createdAt })
    .from(safetyEventsTable)
    .where(eq(safetyEventsTable.userId, linkedUserId))
    .orderBy(desc(safetyEventsTable.createdAt))
    .limit(1);
  engagement.lastSafetyEventAt = lastSafety?.createdAt ? lastSafety.createdAt.toISOString() : null;

  return engagement;
}

/** Format the metadata view as a plain block the model can reason over. */
export function engagementSummary(engagement: PatientEngagement, patientLabel: string): string {
  return [
    `Patient (non-identifying label): ${patientLabel}`,
    `Enrollment status: ${engagement.status}`,
    `Care tier (validated GIS screener): ${engagement.tier ?? "not yet screened"}`,
    `Companion sessions to date: ${engagement.sessionCount}`,
    `Messages the person wrote to the companion: ${engagement.companionMessageCount}`,
    `Journal entries written: ${engagement.journalEntryCount}`,
    `Self check-ins completed: ${engagement.checkinCount}`,
    `Last self check-in: ${engagement.lastCheckinAt ?? "none recorded"}`,
    `Last active: ${engagement.lastActiveAt ?? "no activity recorded"}`,
    `Safety events logged (all time): ${engagement.safetyEventCount}`,
    `Safety events not yet acknowledged: ${engagement.openSafetyEventCount}`,
    `Most recent safety event: ${engagement.lastSafetyEventAt ?? "none"}`,
  ].join("\n");
}

/** Run the bounded provider assistant against a metadata-only view. */
export async function answerProviderQuestion(input: {
  engagement: PatientEngagement;
  patientLabel: string;
  question: string;
}): Promise<string> {
  const metadata = engagementSummary(input.engagement, input.patientLabel);
  return professionalComplete({
    system: providerAssistantSystemPrompt(),
    user: `Engagement metadata for this patient (this is ALL you can see — no session content is available to you):\n\n${metadata}\n\nClinician question: ${input.question}`,
    maxTokens: 700,
  });
}
