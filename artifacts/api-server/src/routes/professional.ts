import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { professionalMeta } from "../lib/professionalMeta";
import providersRouter from "./professionalProviders";
import patientsRouter from "./professionalPatients";
import intakesRouter from "./professionalIntakes";
import referralsRouter from "./professionalReferrals";
import integrationsRouter from "./professionalIntegrations";
import batchRouter from "./professionalBatch";

const router: IRouter = Router();

/**
 * Professional portal — data foundation.
 *
 * The data model (providers, patients, intakes, consents, referrals,
 * integrations), PHI encryption, patient access-control, and audit helpers ship
 * here, along with the CRUD endpoints the later UI phases consume. Every patient
 * PHI field is encrypted on write and decrypted on read; provider-scoped access
 * is enforced centrally (see lib/patientAccess); and every patient CRUD emits an
 * audit-log entry. The provider-facing UI screens are added in later phases.
 */

/** Reference data for onboarding / intake / integrations dropdowns. No PHI. */
router.get("/meta", requireAuth, requireProfessional, (_req, res) => {
  res.json(professionalMeta());
});

router.use(providersRouter);
router.use(patientsRouter);
router.use(intakesRouter);
router.use(referralsRouter);
router.use(integrationsRouter);
router.use(batchRouter);

export default router;
