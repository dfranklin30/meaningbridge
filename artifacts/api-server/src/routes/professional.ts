import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { professionalMeta } from "../lib/professionalMeta";

const router: IRouter = Router();

/**
 * Professional portal — foundation.
 *
 * The data model (providers, patients, intakes, consents, referrals,
 * integrations), PHI encryption, patient access-control, and audit helpers all
 * ship in this phase. The feature endpoints that use them (onboarding,
 * verification, intake, consent, bulk import, EHR) are added in the following
 * phases. This router currently exposes only the shared reference data those
 * UIs read.
 */

/** Reference data for onboarding / intake / integrations dropdowns. No PHI. */
router.get("/meta", requireAuth, requireProfessional, (_req, res) => {
  res.json(professionalMeta());
});

export default router;
