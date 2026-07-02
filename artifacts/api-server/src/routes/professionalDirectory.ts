import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, providersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { requireVerifiedProvider } from "../middlewares/requireVerifiedProvider";
import { logAudit as audit } from "../lib/audit";

const router: IRouter = Router();

/**
 * Opt-in colleague directory ("Dr. Neimeyer's network"). Only verified providers
 * who opted in are listed, and only verified providers may browse it. Returns
 * non-PHI professional profile fields plus the userId needed to send a referral.
 */

router.get("/directory", requireAuth, requireProfessional, requireVerifiedProvider, async (req, res) => {
  const q = String(req.query["q"] ?? "").trim().toLowerCase();
  const specialty = String(req.query["specialty"] ?? "").trim();
  const state = String(req.query["state"] ?? "").trim().toUpperCase();
  const telehealth = req.query["telehealth"];
  const accepting = req.query["accepting"];

  const rows = await db
    .select({
      userId: providersTable.userId,
      fullName: providersTable.fullName,
      credential: providersTable.credential,
      practiceName: providersTable.practiceName,
      specialtyTags: providersTable.specialtyTags,
      statesLicensed: providersTable.statesLicensed,
      telehealth: providersTable.telehealth,
      acceptingReferrals: providersTable.acceptingReferrals,
      bio: providersTable.bio,
    })
    .from(providersTable)
    .where(
      and(
        eq(providersTable.verificationStatus, "verified"),
        eq(providersTable.directoryOptIn, true),
        ne(providersTable.userId, req.userId!),
      ),
    );

  const filtered = rows.filter((r) => {
    if (specialty && !r.specialtyTags.includes(specialty)) return false;
    if (state && !r.statesLicensed.map((s) => s.toUpperCase()).includes(state)) return false;
    if (telehealth === "true" && !r.telehealth) return false;
    if (accepting === "true" && !r.acceptingReferrals) return false;
    if (q) {
      const hay = [r.fullName, r.practiceName, r.bio].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  await audit(req, "directory.search", { detail: `${filtered.length} results` });
  res.json(filtered);
});

export default router;
