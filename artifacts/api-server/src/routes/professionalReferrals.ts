import { Router, type IRouter } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, referralsTable, referralMessagesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { encryptPhi } from "../lib/phi";
import { getPatientForProvider, linkProviderToPatient } from "../lib/patientAccess";
import { toReferralView, toReferralMessageView, parseId } from "../lib/professionalViews";

const router: IRouter = Router();

/**
 * Referrals between providers. The clinical summary and message bodies are PHI
 * and encrypted at rest. Only the sending or receiving provider may read a
 * referral; accepting one grants the recipient patient access via a link row.
 */

const referralInput = z.object({
  patientId: z.number().int().positive(),
  toProviderUserId: z.number().int().positive(),
  summary: z.string().optional(),
});

const respondInput = z.object({ action: z.enum(["accept", "decline"]) });
const messageInput = z.object({ body: z.string().min(1) });

/** Load a referral the current provider participates in, or null. */
async function participantReferral(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.id, id),
        or(
          eq(referralsTable.fromProviderUserId, userId),
          eq(referralsTable.toProviderUserId, userId),
        ),
      ),
    )
    .limit(1);
  return row ?? null;
}

router.get("/referrals", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select()
    .from(referralsTable)
    .where(
      or(
        eq(referralsTable.fromProviderUserId, req.userId!),
        eq(referralsTable.toProviderUserId, req.userId!),
      ),
    )
    .orderBy(desc(referralsTable.createdAt));
  await audit(req, "referral.list", { detail: `${rows.length} referrals` });
  res.json(rows.map(toReferralView));
});

router.post("/referrals", requireAuth, requireProfessional, async (req, res) => {
  const parsed = referralInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid referral", details: parsed.error.issues });
    return;
  }
  const { patientId, toProviderUserId, summary } = parsed.data;

  // Only refer a patient the sending provider can actually access.
  const patient = await getPatientForProvider(req.userId!, patientId);
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  if (toProviderUserId === req.userId!) {
    res.status(400).json({ error: "Cannot refer a patient to yourself" });
    return;
  }

  const [row] = await db
    .insert(referralsTable)
    .values({
      patientId,
      fromProviderUserId: req.userId!,
      toProviderUserId,
      status: "pending",
      summaryEnc: encryptPhi(summary ?? null),
    })
    .returning();

  await audit(req, "referral.create", { detail: `referral ${row!.id} patient ${patientId}` });
  res.status(201).json(toReferralView(row!));
});

router.post("/referrals/:id/respond", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = respondInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid response", details: parsed.error.issues });
    return;
  }

  // Only the recipient may respond, and only while pending.
  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.id, id),
        eq(referralsTable.toProviderUserId, req.userId!),
        eq(referralsTable.status, "pending"),
      ),
    )
    .limit(1);
  if (!referral) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const accepted = parsed.data.action === "accept";
  const [row] = await db
    .update(referralsTable)
    .set({ status: accepted ? "accepted" : "declined", respondedAt: new Date() })
    .where(eq(referralsTable.id, id))
    .returning();

  if (accepted) {
    await linkProviderToPatient(req.userId!, referral.patientId, "referred");
    await audit(req, "patient.create", {
      detail: `linked via referral ${id} patient ${referral.patientId}`,
    });
  }

  await audit(req, "referral.respond", { detail: `referral ${id} ${row!.status}` });
  res.json(toReferralView(row!));
});

router.get("/referrals/:id/messages", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const referral = await participantReferral(req.userId!, id);
  if (!referral) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const rows = await db
    .select()
    .from(referralMessagesTable)
    .where(eq(referralMessagesTable.referralId, id))
    .orderBy(referralMessagesTable.createdAt);
  await audit(req, "referral.message.list", { detail: `referral ${id}` });
  res.json(rows.map(toReferralMessageView));
});

router.post("/referrals/:id/messages", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = messageInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message", details: parsed.error.issues });
    return;
  }
  const referral = await participantReferral(req.userId!, id);
  if (!referral) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [row] = await db
    .insert(referralMessagesTable)
    .values({
      referralId: id,
      senderUserId: req.userId!,
      bodyEnc: encryptPhi(parsed.data.body)!,
    })
    .returning();

  await audit(req, "referral.message.send", { detail: `referral ${id}` });
  res.status(201).json(toReferralMessageView(row!));
});

export default router;
