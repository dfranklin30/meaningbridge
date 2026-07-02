import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { requireVerifiedProvider } from "../middlewares/requireVerifiedProvider";
import { requireTwoFactor } from "../middlewares/requireTwoFactor";
import { professionalMeta } from "../lib/professionalMeta";
import providersRouter from "./professionalProviders";
import securityRouter from "./professionalSecurity";
import directoryRouter from "./professionalDirectory";
import adminRouter from "./professionalAdmin";
import patientsRouter from "./professionalPatients";
import careRouter from "./professionalCare";
import intakesRouter from "./professionalIntakes";
import referralsRouter from "./professionalReferrals";
import integrationsRouter from "./professionalIntegrations";
import integrationsCallbackRouter from "./professionalIntegrationsCallback";
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

// Account-management routers: reachable before verification / 2FA so a provider
// can onboard, enroll a second factor, and (once verified) browse the directory.
router.use(providersRouter);
router.use(securityRouter);
router.use(directoryRouter);
router.use(adminRouter);

// The SMART-on-FHIR OAuth callback is a top-level browser redirect from the EHR
// and so cannot satisfy the interactive two-factor gate below. It is mounted
// BEFORE the phiGate routers (whose `router.use(phiGate, ...)` layers otherwise
// run requireTwoFactor for every unmatched path) so this path is handled first.
// It still requires a verified provider, and the single-use state row created at
// authorize time (behind the full gate) binds the flow to the initiating provider.
const providerGate = [requireAuth, requireProfessional, requireVerifiedProvider];
router.use(providerGate, integrationsCallbackRouter);

// PHI routers: gated behind admin verification AND an active second factor.
// Applied at mount so no individual PHI route can forget the gate.
const phiGate = [requireAuth, requireProfessional, requireVerifiedProvider, requireTwoFactor];
router.use(phiGate, patientsRouter);
router.use(phiGate, careRouter);
router.use(phiGate, intakesRouter);
router.use(phiGate, referralsRouter);
router.use(phiGate, integrationsRouter);
router.use(phiGate, batchRouter);

export default router;
