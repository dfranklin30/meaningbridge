import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, providersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { toProviderView } from "../lib/professionalViews";

const router: IRouter = Router();

/**
 * Provider profile — the clinician's own account record. No patient PHI here
 * (the profile describes the account holder), so fields are plain text.
 * Verification is admin-controlled and can never be self-set.
 */

const providerInput = z.object({
  fullName: z.string().min(1),
  credential: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseState: z.string().optional(),
  npi: z.string().optional(),
  practiceName: z.string().optional(),
  practiceAddress: z.string().optional(),
  directoryOptIn: z.boolean().optional(),
  specialtyTags: z.array(z.string()).optional(),
  statesLicensed: z.array(z.string()).optional(),
  telehealth: z.boolean().optional(),
  acceptingReferrals: z.boolean().optional(),
  bio: z.string().optional(),
});

router.post("/providers", requireAuth, requireProfessional, async (req, res) => {
  const parsed = providerInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid provider profile", details: parsed.error.issues });
    return;
  }

  const [existing] = await db
    .select({ id: providersTable.id })
    .from(providersTable)
    .where(eq(providersTable.userId, req.userId!))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Provider profile already exists" });
    return;
  }

  const [row] = await db
    .insert(providersTable)
    .values({ userId: req.userId!, ...parsed.data })
    .returning();

  await audit(req, "provider.create", { detail: parsed.data.credential ?? undefined });
  res.status(201).json(toProviderView(row!));
});

router.get("/providers/me", requireAuth, requireProfessional, async (req, res) => {
  const [row] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.userId, req.userId!))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No provider profile yet" });
    return;
  }
  res.json(toProviderView(row));
});

router.patch("/providers/me", requireAuth, requireProfessional, async (req, res) => {
  const parsed = providerInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid provider profile", details: parsed.error.issues });
    return;
  }

  const [row] = await db
    .update(providersTable)
    .set(parsed.data)
    .where(eq(providersTable.userId, req.userId!))
    .returning();
  if (!row) {
    res.status(404).json({ error: "No provider profile yet" });
    return;
  }

  await audit(req, "provider.update");
  res.json(toProviderView(row));
});

export default router;
