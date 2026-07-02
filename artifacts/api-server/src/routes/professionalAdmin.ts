import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, gte, ilike, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { db, providersTable, usersTable, auditLogTable, patientsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logAudit as audit } from "../lib/audit";
import { toProviderView, parseId } from "../lib/professionalViews";

const router: IRouter = Router();

/**
 * Admin verification queue. Provider verification is admin-controlled and never
 * self-service (see providers schema). All routes require the platform-admin
 * flag; each decision is audit-logged with the affected provider's user id.
 */

const statusQuery = z.enum(["pending", "verified", "rejected", "all"]);
const decisionInput = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

router.get("/admin/providers", requireAuth, requireAdmin, async (req, res) => {
  const status = statusQuery.catch("pending").parse(req.query["status"]);

  const base = db
    .select({
      provider: providersTable,
      userEmail: usersTable.email,
      userFirstName: usersTable.firstName,
    })
    .from(providersTable)
    .innerJoin(usersTable, eq(providersTable.userId, usersTable.id))
    .orderBy(desc(providersTable.createdAt));

  const rows =
    status === "all"
      ? await base
      : await base.where(eq(providersTable.verificationStatus, status));

  await audit(req, "admin.provider.list", { detail: `${rows.length} providers (${status})` });
  res.json(
    rows.map((r) => ({
      ...toProviderView(r.provider),
      userEmail: r.userEmail,
      userFirstName: r.userFirstName,
    })),
  );
});

router.post("/admin/providers/:id/decision", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = decisionInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid decision", details: parsed.error.issues });
    return;
  }

  const approve = parsed.data.action === "approve";
  const [row] = await db
    .update(providersTable)
    .set({
      verificationStatus: approve ? "verified" : "rejected",
      verificationNote: parsed.data.note ?? null,
      verifiedAt: approve ? new Date() : null,
      verifiedByUserId: req.userId!,
    })
    .where(eq(providersTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  await audit(req, "admin.provider.decision", {
    subjectUserId: row.userId,
    detail: `${row.verificationStatus} provider ${id}`,
  });
  res.json(toProviderView(row));
});

/**
 * Audit-trail oversight. The append-only audit log is the compliance record of
 * every sensitive read/write; only platform admins may inspect or export it.
 * Filters narrow by action (substring), actor, subject, and a date range. The
 * viewing/export action is itself audited.
 */
const auditQuery = z.object({
  action: z.string().trim().min(1).optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
  subjectUserId: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).catch(100),
  offset: z.coerce.number().int().min(0).catch(0),
});

function auditWhere(q: z.infer<typeof auditQuery>) {
  const conds = [];
  if (q.action) conds.push(ilike(auditLogTable.action, `%${q.action}%`));
  if (q.actorUserId) conds.push(eq(auditLogTable.actorUserId, q.actorUserId));
  if (q.subjectUserId) conds.push(eq(auditLogTable.subjectUserId, q.subjectUserId));
  if (q.from) {
    const d = new Date(q.from);
    if (!Number.isNaN(d.getTime())) conds.push(gte(auditLogTable.createdAt, d));
  }
  if (q.to) {
    const d = new Date(q.to);
    if (!Number.isNaN(d.getTime())) conds.push(lte(auditLogTable.createdAt, d));
  }
  return conds.length ? and(...conds) : undefined;
}

function auditSelect(q: z.infer<typeof auditQuery>) {
  const actor = alias(usersTable, "audit_actor");
  const subject = alias(usersTable, "audit_subject");
  return db
    .select({
      id: auditLogTable.id,
      action: auditLogTable.action,
      actorUserId: auditLogTable.actorUserId,
      actorEmail: actor.email,
      subjectUserId: auditLogTable.subjectUserId,
      subjectEmail: subject.email,
      relationshipId: auditLogTable.relationshipId,
      detail: auditLogTable.detail,
      ip: auditLogTable.ip,
      createdAt: auditLogTable.createdAt,
    })
    .from(auditLogTable)
    .leftJoin(actor, eq(auditLogTable.actorUserId, actor.id))
    .leftJoin(subject, eq(auditLogTable.subjectUserId, subject.id))
    .where(auditWhere(q))
    .orderBy(desc(auditLogTable.createdAt));
}

router.get("/admin/audit", requireAuth, requireAdmin, async (req, res) => {
  const q = auditQuery.parse(req.query);
  const rows = await auditSelect(q).limit(q.limit).offset(q.offset);
  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogTable)
    .where(auditWhere(q));
  const total = totals?.total ?? 0;
  await audit(req, "admin.audit.view", { detail: `${rows.length} of ${total} entries` });
  res.json({ rows, total, limit: q.limit, offset: q.offset });
});

// Rows are streamed to the client in stable, keyset-paginated chunks (by
// ascending id) so the full immutable audit trail is always exported — never a
// silently truncated slice. Keyset (id > cursor) rather than OFFSET keeps the
// page stable even while new entries append concurrently.
const EXPORT_CHUNK = 1000;

router.get("/admin/audit/export", requireAuth, requireAdmin, async (req, res) => {
  const q = auditQuery.parse(req.query);
  const actor = alias(usersTable, "audit_actor");
  const subject = alias(usersTable, "audit_subject");
  const filter = auditWhere(q);

  const header = [
    "id",
    "createdAt",
    "action",
    "actorUserId",
    "actorEmail",
    "subjectUserId",
    "subjectEmail",
    "relationshipId",
    "ip",
    "detail",
  ];
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="meaningbridge-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.write(header.join(",") + "\n");

  let cursor = 0;
  let exported = 0;
  for (;;) {
    const conds = [gt(auditLogTable.id, cursor)];
    if (filter) conds.push(filter);
    const rows = await db
      .select({
        id: auditLogTable.id,
        action: auditLogTable.action,
        actorUserId: auditLogTable.actorUserId,
        actorEmail: actor.email,
        subjectUserId: auditLogTable.subjectUserId,
        subjectEmail: subject.email,
        relationshipId: auditLogTable.relationshipId,
        detail: auditLogTable.detail,
        ip: auditLogTable.ip,
        createdAt: auditLogTable.createdAt,
      })
      .from(auditLogTable)
      .leftJoin(actor, eq(auditLogTable.actorUserId, actor.id))
      .leftJoin(subject, eq(auditLogTable.subjectUserId, subject.id))
      .where(and(...conds))
      .orderBy(asc(auditLogTable.id))
      .limit(EXPORT_CHUNK);

    if (rows.length === 0) break;
    const chunk = rows
      .map((r) =>
        [
          r.id,
          r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          r.action,
          r.actorUserId,
          r.actorEmail,
          r.subjectUserId,
          r.subjectEmail,
          r.relationshipId,
          r.ip,
          r.detail,
        ]
          .map(esc)
          .join(","),
      )
      .join("\n");
    res.write(chunk + "\n");
    exported += rows.length;
    cursor = rows[rows.length - 1]!.id;
    if (rows.length < EXPORT_CHUNK) break;
  }

  await audit(req, "admin.audit.export", { detail: `${exported} entries` });
  res.end();
});

/**
 * De-identified platform analytics. Returns only aggregate integer counts —
 * never names, dates of birth, or any patient identifier — so the oversight
 * dashboard can show scale without exposing PHI (HIPAA "minimum necessary").
 */
router.get("/admin/metrics", requireAuth, requireAdmin, async (req, res) => {
  const n = sql<number>`count(*)::int`;
  const [users] = await db.select({ n }).from(usersTable);
  const [seekers] = await db.select({ n }).from(usersTable).where(eq(usersTable.role, "seeker"));
  const [providers] = await db
    .select({ n })
    .from(usersTable)
    .where(eq(usersTable.role, "professional"));
  const [patients] = await db.select({ n }).from(patientsTable);
  const [activePatients] = await db
    .select({ n })
    .from(patientsTable)
    .where(eq(patientsTable.status, "active"));
  const [auditEntries] = await db.select({ n }).from(auditLogTable);
  await audit(req, "admin.metrics.view");
  res.json({
    users: users?.n ?? 0,
    seekers: seekers?.n ?? 0,
    professionals: providers?.n ?? 0,
    patients: patients?.n ?? 0,
    activePatients: activePatients?.n ?? 0,
    auditEntries: auditEntries?.n ?? 0,
  });
});

export default router;
