import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, integrationConnectionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { encryptPhi } from "../lib/phi";
import { toIntegrationView, parseId } from "../lib/professionalViews";

const router: IRouter = Router();

/**
 * A provider's EHR / practice-system connections. OAuth tokens are secrets and
 * are encrypted at rest and never returned in any response. One connection row
 * per (provider, system); re-posting the same system updates it.
 */

const integrationInput = z.object({
  system: z.string().min(1),
  kind: z.enum(["fhir", "csv_preset", "vendor_api"]).optional(),
  status: z.enum(["connected", "disconnected", "pending"]).optional(),
  scopes: z.string().optional(),
  fhirBaseUrl: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

router.get("/integrations", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select()
    .from(integrationConnectionsTable)
    .where(eq(integrationConnectionsTable.providerUserId, req.userId!))
    .orderBy(desc(integrationConnectionsTable.createdAt));
  await audit(req, "integration.list", { detail: `${rows.length} connections` });
  res.json(rows.map(toIntegrationView));
});

router.post("/integrations", requireAuth, requireProfessional, async (req, res) => {
  const parsed = integrationInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid connection", details: parsed.error.issues });
    return;
  }
  const { system, kind, status, scopes, fhirBaseUrl, accessToken, refreshToken } = parsed.data;
  const connected = status === "connected";

  const [row] = await db
    .insert(integrationConnectionsTable)
    .values({
      providerUserId: req.userId!,
      system,
      kind: kind ?? "fhir",
      status: status ?? "disconnected",
      scopes: scopes ?? null,
      fhirBaseUrl: fhirBaseUrl ?? null,
      accessTokenEnc: encryptPhi(accessToken ?? null),
      refreshTokenEnc: encryptPhi(refreshToken ?? null),
      connectedByUserId: req.userId!,
      connectedAt: connected ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [
        integrationConnectionsTable.providerUserId,
        integrationConnectionsTable.system,
      ],
      set: {
        kind: kind ?? "fhir",
        status: status ?? "disconnected",
        scopes: scopes ?? null,
        fhirBaseUrl: fhirBaseUrl ?? null,
        accessTokenEnc: encryptPhi(accessToken ?? null),
        refreshTokenEnc: encryptPhi(refreshToken ?? null),
        connectedByUserId: req.userId!,
        connectedAt: connected ? new Date() : null,
      },
    })
    .returning();

  await audit(req, "integration.upsert", { detail: `${system} ${row!.status}` });
  res.status(201).json(toIntegrationView(row!));
});

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
    .returning({ id: integrationConnectionsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await audit(req, "integration.delete", { detail: `connection ${id}` });
  res.status(204).end();
});

export default router;
