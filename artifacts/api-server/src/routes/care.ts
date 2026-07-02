import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { db, careRelationshipsTable, usersTable, type CareRelationship } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";

const router: IRouter = Router();

/**
 * Phase 1 — clinician<>client connection and consent foundation.
 *
 * Every endpoint is scoped to the authenticated account. Clinician endpoints
 * additionally require the "professional" role. Consent is opt-in and only the
 * client may change it. Sensitive reads/writes are recorded in the audit log.
 */

// ---- helpers ---------------------------------------------------------------

function newInviteCode(): string {
  // URL-safe, ~11 chars, ample entropy. Uppercased for readability when typed.
  return randomBytes(8).toString("base64url").replace(/[-_]/g, "").slice(0, 10).toUpperCase();
}

function asBool(v: unknown): boolean {
  return v === true;
}

/** Shape a relationship for the CLIENT's view (their clinicians). */
function clientView(rel: CareRelationship, clinicianName: string | null, clinicianEmail: string | null) {
  return {
    id: rel.id,
    status: rel.status,
    clinicianName,
    clinicianEmail,
    consentSummaries: rel.consentSummaries,
    consentSafety: rel.consentSafety,
    consentEngagement: rel.consentEngagement,
    createdAt: rel.createdAt,
    acceptedAt: rel.acceptedAt,
  };
}

// ---- clinician endpoints ---------------------------------------------------

/** Create an invitation. Returns the code/link the clinician shares with a client. */
router.post("/invites", requireAuth, requireProfessional, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() || null : null;
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) || null : null;

  // Generate a unique code (retry on the rare collision).
  let row: CareRelationship | undefined;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    try {
      [row] = await db
        .insert(careRelationshipsTable)
        .values({
          clinicianUserId: req.userId!,
          inviteCode: newInviteCode(),
          inviteEmail: email,
          inviteNote: note,
          status: "pending",
        })
        .returning();
    } catch {
      // Likely a unique-constraint collision on invite_code; loop and retry.
    }
  }
  if (!row) {
    res.status(500).json({ error: "Could not create invite" });
    return;
  }

  await audit(req, "care.invite.create", { relationshipId: row.id, detail: email ?? undefined });
  res.status(201).json({
    id: row.id,
    inviteCode: row.inviteCode,
    inviteEmail: row.inviteEmail,
    status: row.status,
    createdAt: row.createdAt,
  });
});

/** List the clinician's outstanding (not-yet-redeemed) invites. */
router.get("/invites", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select()
    .from(careRelationshipsTable)
    .where(
      and(
        eq(careRelationshipsTable.clinicianUserId, req.userId!),
        eq(careRelationshipsTable.status, "pending"),
        isNull(careRelationshipsTable.clientUserId),
      ),
    )
    .orderBy(desc(careRelationshipsTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      inviteCode: r.inviteCode,
      inviteEmail: r.inviteEmail,
      inviteNote: r.inviteNote,
      status: r.status,
      createdAt: r.createdAt,
    })),
  );
});

/**
 * The clinician's roster: clients who have connected. Returns only minimal
 * identity plus the per-category consent flags (data minimization). Engagement,
 * safety counts, and AI briefings arrive in later phases and are gated on the
 * matching consent flag.
 */
router.get("/roster", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select({
      rel: careRelationshipsTable,
      clientFirstName: usersTable.firstName,
      clientEmail: usersTable.email,
    })
    .from(careRelationshipsTable)
    .leftJoin(usersTable, eq(usersTable.id, careRelationshipsTable.clientUserId))
    .where(
      and(
        eq(careRelationshipsTable.clinicianUserId, req.userId!),
        eq(careRelationshipsTable.status, "active"),
      ),
    )
    .orderBy(desc(careRelationshipsTable.acceptedAt));

  await audit(req, "care.roster.view", { detail: `${rows.length} clients` });

  res.json(
    rows.map(({ rel, clientFirstName, clientEmail }) => ({
      id: rel.id,
      clientUserId: rel.clientUserId,
      clientFirstName: clientFirstName ?? null,
      clientEmail: clientEmail ?? null,
      status: rel.status,
      consentSummaries: rel.consentSummaries,
      consentSafety: rel.consentSafety,
      consentEngagement: rel.consentEngagement,
      acceptedAt: rel.acceptedAt,
    })),
  );
});

// ---- client (seeker) endpoints --------------------------------------------

/**
 * Redeem an invite code and connect to a clinician, setting initial consent.
 * Any authenticated account may connect (a client need not be a "seeker" role).
 */
router.post("/connect", requireAuth, async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  if (!code) {
    res.status(400).json({ error: "An invite code is required" });
    return;
  }

  const [invite] = await db
    .select()
    .from(careRelationshipsTable)
    .where(eq(careRelationshipsTable.inviteCode, code))
    .limit(1);

  if (!invite || invite.status !== "pending" || invite.clientUserId !== null) {
    res.status(404).json({ error: "That invite code is not valid or has already been used" });
    return;
  }
  if (invite.clinicianUserId === req.userId!) {
    res.status(400).json({ error: "You cannot connect an invite to your own account" });
    return;
  }

  // Redeem atomically: the WHERE re-checks pending + unclaimed so two
  // concurrent redemptions cannot both succeed and overwrite ownership.
  const [updated] = await db
    .update(careRelationshipsTable)
    .set({
      clientUserId: req.userId!,
      status: "active",
      acceptedAt: new Date(),
      consentSummaries: asBool(req.body?.consentSummaries),
      consentSafety: asBool(req.body?.consentSafety),
      consentEngagement: asBool(req.body?.consentEngagement),
    })
    .where(
      and(
        eq(careRelationshipsTable.id, invite.id),
        eq(careRelationshipsTable.status, "pending"),
        isNull(careRelationshipsTable.clientUserId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(409).json({ error: "That invite code has already been used" });
    return;
  }

  await audit(req, "care.connect", {
    relationshipId: updated.id,
    subjectUserId: req.userId!,
    detail: `clinician ${updated.clinicianUserId}`,
  });

  const [clinician] = await db
    .select({ firstName: usersTable.firstName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, updated.clinicianUserId));

  res.status(201).json(clientView(updated, clinician?.firstName ?? null, clinician?.email ?? null));
});

/** A client's view of the clinicians they are connected to. */
router.get("/connections", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      rel: careRelationshipsTable,
      clinicianFirstName: usersTable.firstName,
      clinicianEmail: usersTable.email,
    })
    .from(careRelationshipsTable)
    .leftJoin(usersTable, eq(usersTable.id, careRelationshipsTable.clinicianUserId))
    .where(
      and(
        eq(careRelationshipsTable.clientUserId, req.userId!),
        or(
          eq(careRelationshipsTable.status, "active"),
          eq(careRelationshipsTable.status, "revoked"),
        ),
      ),
    )
    .orderBy(desc(careRelationshipsTable.acceptedAt));

  res.json(rows.map(({ rel, clinicianFirstName, clinicianEmail }) =>
    clientView(rel, clinicianFirstName ?? null, clinicianEmail ?? null),
  ));
});

/** Update consent for one of the client's own connections. Client-only. */
router.patch("/connections/:id/consent", requireAuth, async (req, res) => {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [rel] = await db
    .select()
    .from(careRelationshipsTable)
    .where(
      and(
        eq(careRelationshipsTable.id, id),
        eq(careRelationshipsTable.clientUserId, req.userId!),
        eq(careRelationshipsTable.status, "active"),
      ),
    );
  if (!rel) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const next = {
    consentSummaries:
      typeof req.body?.consentSummaries === "boolean" ? req.body.consentSummaries : rel.consentSummaries,
    consentSafety:
      typeof req.body?.consentSafety === "boolean" ? req.body.consentSafety : rel.consentSafety,
    consentEngagement:
      typeof req.body?.consentEngagement === "boolean" ? req.body.consentEngagement : rel.consentEngagement,
  };

  const [updated] = await db
    .update(careRelationshipsTable)
    .set(next)
    .where(eq(careRelationshipsTable.id, id))
    .returning();

  await audit(req, "care.consent.update", {
    relationshipId: id,
    subjectUserId: req.userId!,
    detail: `summaries=${next.consentSummaries} safety=${next.consentSafety} engagement=${next.consentEngagement}`,
  });

  res.json(clientView(updated, null, null));
});

/**
 * Revoke / disconnect a relationship. Either party (the clinician who created
 * it, or the client who connected) may revoke. Takes effect immediately.
 */
router.post("/connections/:id/revoke", requireAuth, async (req, res) => {
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [rel] = await db
    .select()
    .from(careRelationshipsTable)
    .where(
      and(
        eq(careRelationshipsTable.id, id),
        or(
          eq(careRelationshipsTable.clientUserId, req.userId!),
          eq(careRelationshipsTable.clinicianUserId, req.userId!),
        ),
      ),
    );
  if (!rel) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Revocation deactivates the relationship AND withdraws every consent flag, so
  // no future data can reach the clinician even if the row were ever re-opened.
  const [updated] = await db
    .update(careRelationshipsTable)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      consentSummaries: false,
      consentSafety: false,
      consentEngagement: false,
    })
    .where(eq(careRelationshipsTable.id, id))
    .returning();

  await audit(req, "care.revoke", {
    relationshipId: id,
    subjectUserId: rel.clientUserId ?? undefined,
  });

  res.json({ id: updated.id, status: updated.status });
});

export default router;
