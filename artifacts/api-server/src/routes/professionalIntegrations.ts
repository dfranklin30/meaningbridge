import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  integrationConnectionsTable,
  integrationOAuthStatesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { encryptPhi } from "../lib/phi";
import { appOrigin } from "../lib/appUrl";
import { toIntegrationView, parseId } from "../lib/professionalViews";
import { INTEGRATION_SYSTEMS } from "../lib/professionalMeta";
import { getFhirConfig, isFhirConfigured, isFhirSystem } from "../lib/fhirConfig";
import {
  buildAuthorizeUrl,
  discoverSmartEndpoints,
  generatePkce,
  generateState,
  FhirError,
} from "../lib/fhirClient";

const router: IRouter = Router();

/** The OAuth callback path the EHR redirects back to (must match registration). */
export const FHIR_CALLBACK_PATH = "/professional/integrations/fhir/callback";
function callbackUri(req: import("express").Request): string {
  return `${appOrigin(req)}/api${FHIR_CALLBACK_PATH}`;
}

/**
 * A provider's EHR / practice-system connections.
 *
 * Three tiers: a live SMART-on-FHIR OAuth connection (Epic, athenahealth), saved
 * CSV export presets that feed bulk upload, and "request access" stubs for
 * partner APIs that require a signed agreement. OAuth tokens are encrypted at
 * rest and never returned in any response; one connection row per (provider,
 * system). Every mutation is audited.
 *
 * Note: the browser-redirect OAuth callback lives in a sibling router mounted
 * without the two-factor gate (a top-level navigation cannot render the 2FA
 * modal); it is bound to the initiating provider by a single-use state row.
 */

/**
 * The full integrations catalog for the settings page: every known system with
 * its tier, this provider's connection (if any), and — for FHIR systems —
 * whether live credentials are configured (so the UI can show an honest
 * "configuration required" state instead of a dead connect button).
 */
router.get("/integrations/catalog", requireAuth, requireProfessional, async (req, res) => {
  const connections = await db
    .select()
    .from(integrationConnectionsTable)
    .where(eq(integrationConnectionsTable.providerUserId, req.userId!));
  const bySystem = new Map(connections.map((c) => [c.system, c]));

  const systems = INTEGRATION_SYSTEMS.map((s) => {
    const conn = bySystem.get(s.id);
    return {
      id: s.id,
      label: s.label,
      kind: s.kind,
      fhirConfigured: s.kind === "fhir" && isFhirSystem(s.id) ? isFhirConfigured(s.id) : false,
      connection: conn ? toIntegrationView(conn) : null,
    };
  });

  await audit(req, "integration.catalog", { detail: `${systems.length} systems` });
  res.json({ systems });
});

/** Raw list of this provider's connections (tokens never included). */
router.get("/integrations", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select()
    .from(integrationConnectionsTable)
    .where(eq(integrationConnectionsTable.providerUserId, req.userId!))
    .orderBy(desc(integrationConnectionsTable.createdAt));
  res.json(rows.map(toIntegrationView));
});

/**
 * Begin a SMART-on-FHIR authorization. Discovers the vendor's endpoints,
 * generates PKCE + CSRF state bound to this provider, and returns the authorize
 * URL for the client to navigate to. Returns 400 `configuration_required` when
 * the system has no live credentials — never a faked success.
 */
router.post(
  "/integrations/fhir/:system/authorize",
  requireAuth,
  requireProfessional,
  async (req, res) => {
    const system = String(req.params.system);
    if (!isFhirSystem(system)) {
      res.status(400).json({ error: "Not a live-FHIR system." });
      return;
    }
    const config = getFhirConfig(system);
    if (!config) {
      res.status(400).json({
        error:
          "This EHR is not yet configured for a live connection. An administrator must register MeaningBridge with the EHR and add its credentials.",
        code: "configuration_required",
      });
      return;
    }

    try {
      const endpoints = await discoverSmartEndpoints(config.iss);
      const { codeVerifier, codeChallenge } = generatePkce();
      const state = generateState();
      const redirectUri = callbackUri(req);

      await db.insert(integrationOAuthStatesTable).values({
        state,
        providerUserId: req.userId!,
        system,
        codeVerifierEnc: encryptPhi(codeVerifier)!,
        fhirBaseUrl: config.iss,
        tokenUrl: endpoints.tokenEndpoint,
        scope: config.scopes,
        redirectUri,
      });

      const authorizeUrl = buildAuthorizeUrl({
        authorizationEndpoint: endpoints.authorizationEndpoint,
        config,
        redirectUri,
        state,
        codeChallenge,
      });

      await audit(req, "integration.authorize", { detail: system });
      res.json({ authorizeUrl });
    } catch (err) {
      if (err instanceof FhirError) {
        req.log.warn({ err, system }, "FHIR authorize failed");
        res.status(502).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

/**
 * Record a request to enable a partner-API vendor. These require a signed
 * agreement and are not live; we persist a "pending" connection so the request,
 * who made it, and when are on record, and surface a "requested" state.
 */
const requestAccessInput = z.object({ note: z.string().max(2000).optional() });

router.post(
  "/integrations/:system/request-access",
  requireAuth,
  requireProfessional,
  async (req, res) => {
    const system = String(req.params.system);
    const catalog = INTEGRATION_SYSTEMS.find((s) => s.id === system);
    if (!catalog || catalog.kind !== "vendor_api") {
      res.status(400).json({ error: "This system does not use request-access." });
      return;
    }
    const parsed = requestAccessInput.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      return;
    }

    const [row] = await db
      .insert(integrationConnectionsTable)
      .values({
        providerUserId: req.userId!,
        system,
        kind: "vendor_api",
        status: "pending",
        connectedByUserId: req.userId!,
        connectedAt: null,
      })
      .onConflictDoUpdate({
        target: [
          integrationConnectionsTable.providerUserId,
          integrationConnectionsTable.system,
        ],
        set: { kind: "vendor_api", status: "pending", connectedByUserId: req.userId! },
      })
      .returning();

    await audit(req, "integration.request_access", { detail: system });
    res.status(201).json(toIntegrationView(row!));
  },
);

/**
 * Disconnect a connection by id: deletes the row, which clears the encrypted
 * access/refresh tokens we hold so a previously granted connection can no longer
 * be used from MeaningBridge.
 */
router.delete("/integrations/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await db
    .delete(integrationConnectionsTable)
    .where(
      and(
        eq(integrationConnectionsTable.id, id),
        eq(integrationConnectionsTable.providerUserId, req.userId!),
      ),
    )
    .returning({ id: integrationConnectionsTable.id, system: integrationConnectionsTable.system });
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await audit(req, "integration.disconnect", { detail: result[0]!.system });
  res.status(204).end();
});

export default router;
