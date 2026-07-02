import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  integrationConnectionsTable,
  integrationOAuthStatesTable,
  intakesTable,
} from "@workspace/db";
import { logAudit as audit } from "../lib/audit";
import { encryptPhi, encryptPhiJson, decryptPhi } from "../lib/phi";
import { appOrigin } from "../lib/appUrl";
import { getFhirConfig, isFhirSystem } from "../lib/fhirConfig";
import { exchangeCode, fetchPatientPull, mapPullToIntakeData, FhirError } from "../lib/fhirClient";

const router: IRouter = Router();

/** OAuth state lifetime: authorization must complete within this window. */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * SMART-on-FHIR OAuth callback. Deliberately mounted WITHOUT the two-factor gate
 * that guards the other integration routes: this endpoint is reached by a
 * top-level browser redirect from the EHR, which cannot render a 2FA modal. The
 * flow is instead bound to the initiating provider by a single-use `state` row
 * (created behind the full gate at authorize time) that also carries the PKCE
 * verifier and the discovered token endpoint. The row is consumed on use.
 *
 * On success we store the encrypted tokens + granted scopes (the connection
 * record), pull the selected patient's demographics (plus optional conditions /
 * medications), create a prefilled draft intake, and redirect the clinician into
 * the intake editor to review before anything is submitted. We never write back
 * to the EHR.
 */

/** Redirect to a web-app route, preserving a single status query param. */
function redirectApp(
  req: import("express").Request,
  res: import("express").Response,
  path: string,
): void {
  res.redirect(`${appOrigin(req)}${path}`);
}

router.get("/integrations/fhir/callback", async (req, res) => {
  const back = "/care/integrations";
  const stateParam = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";

  if (oauthError) {
    redirectApp(req, res, `${back}?error=access_denied`);
    return;
  }
  if (!stateParam || !code) {
    redirectApp(req, res, `${back}?error=invalid_callback`);
    return;
  }

  // Atomically consume the single-use state row bound to this provider: a single
  // DELETE ... RETURNING guarantees exactly one concurrent callback wins the row,
  // so a duplicated/replayed `state` cannot drive two token exchanges.
  const [stateRow] = await db
    .delete(integrationOAuthStatesTable)
    .where(
      and(
        eq(integrationOAuthStatesTable.state, stateParam),
        eq(integrationOAuthStatesTable.providerUserId, req.userId!),
      ),
    )
    .returning();

  if (!stateRow) {
    redirectApp(req, res, `${back}?error=state_expired`);
    return;
  }

  // Bound the replay window for an abandoned-but-not-consumed state.
  if (Date.now() - stateRow.createdAt.getTime() > STATE_TTL_MS) {
    redirectApp(req, res, `${back}?error=state_expired`);
    return;
  }

  const system = stateRow.system;
  if (!isFhirSystem(system)) {
    redirectApp(req, res, `${back}?error=invalid_callback`);
    return;
  }
  const config = getFhirConfig(system);
  if (!config) {
    redirectApp(req, res, `${back}?error=configuration_required`);
    return;
  }

  const codeVerifier = decryptPhi(stateRow.codeVerifierEnc);
  if (!codeVerifier) {
    redirectApp(req, res, `${back}?error=invalid_callback`);
    return;
  }

  try {
    const token = await exchangeCode({
      tokenEndpoint: stateRow.tokenUrl,
      config,
      code,
      redirectUri: stateRow.redirectUri,
      codeVerifier,
    });

    // Record the connection (encrypted tokens + granted scopes, actor, time).
    await db
      .insert(integrationConnectionsTable)
      .values({
        providerUserId: req.userId!,
        system,
        kind: "fhir",
        status: "connected",
        scopes: token.scope ?? stateRow.scope,
        fhirBaseUrl: stateRow.fhirBaseUrl,
        accessTokenEnc: encryptPhi(token.accessToken),
        refreshTokenEnc: encryptPhi(token.refreshToken),
        tokenExpiresAt: token.expiresAt,
        connectedByUserId: req.userId!,
        connectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          integrationConnectionsTable.providerUserId,
          integrationConnectionsTable.system,
        ],
        set: {
          kind: "fhir",
          status: "connected",
          scopes: token.scope ?? stateRow.scope,
          fhirBaseUrl: stateRow.fhirBaseUrl,
          accessTokenEnc: encryptPhi(token.accessToken),
          refreshTokenEnc: encryptPhi(token.refreshToken),
          tokenExpiresAt: token.expiresAt,
          connectedByUserId: req.userId!,
          connectedAt: new Date(),
        },
      });

    await audit(req, "integration.connect", { detail: system });

    // No patient in context (patient scope not granted): connection is recorded,
    // but there is nothing to prefill. Return to the settings page.
    if (!token.patient) {
      redirectApp(req, res, `${back}?connected=${encodeURIComponent(system)}`);
      return;
    }

    const pull = await fetchPatientPull({
      fhirBaseUrl: stateRow.fhirBaseUrl,
      accessToken: token.accessToken,
      patientId: token.patient,
    });
    const data = mapPullToIntakeData(pull);

    const [intake] = await db
      .insert(intakesTable)
      .values({
        providerUserId: req.userId!,
        patientId: null,
        status: "draft",
        dataEnc: encryptPhiJson(data),
        // FHIR pulls carry only demographics/diagnoses — never the screening
        // answers that set the risk flag, so a pulled draft is never risk-flagged
        // until the clinician completes the clinical section in the editor.
        riskFlag: false,
        safetyPlanConfirmed: false,
        submittedAt: null,
      })
      .returning();

    await audit(req, "intake.create", { detail: `intake ${intake!.id} via ${system} FHIR pull` });
    redirectApp(req, res, `/care/intake/${intake!.id}?imported=${encodeURIComponent(system)}`);
  } catch (err) {
    const code = err instanceof FhirError ? err.code : "connect_failed";
    req.log.error({ err, system }, "FHIR callback failed");
    redirectApp(req, res, `${back}?error=${encodeURIComponent(code)}`);
  }
});

export default router;
