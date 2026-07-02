import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, providersTable, usersTable } from "@workspace/db";
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

export default router;
