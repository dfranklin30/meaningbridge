import { Router, type IRouter } from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, batchImportsTable, providersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { appOrigin } from "../lib/appUrl";
import { enrollInvitedPatient } from "../lib/patientEnrollment";
import { toBatchImportView, parseId } from "../lib/professionalViews";
import {
  BULK_FIELDS,
  BulkImportError,
  MAX_BULK_ROWS,
  buildTemplateCsv,
  parseSpreadsheet,
  suggestMapping,
  validateRows,
  type CanonicalRow,
} from "../lib/bulkImport";
import { getCsvPreset } from "../lib/csvPresets";

const router: IRouter = Router();

/**
 * Bulk patient import. A provider downloads a template, uploads a CSV/XLSX,
 * maps columns to canonical fields, previews a per-row validation report, then
 * commits — which enrolls each accepted row through the same shared helper the
 * single-intake flow uses (create patient + consent invite) and records an
 * import log. All routes here are already behind the PHI gate (see
 * professional.ts): requireVerifiedProvider + an active second factor.
 */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** A canonical row as sent from the client after mapping. All fields optional. */
const canonicalRowSchema = z.object({
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  dob: z.string().optional().default(""),
  pronouns: z.string().optional().default(""),
});

const rowsInput = z.object({
  rows: z.array(canonicalRowSchema).max(MAX_BULK_ROWS),
});

const commitInput = z.object({
  filename: z.string().optional(),
  source: z.enum(["csv", "xlsx"]).default("csv"),
  // When the upload came in through an EHR export preset, the run is tagged
  // `ehr:<system>` so the import log records where the roster originated.
  preset: z.string().max(64).optional(),
  rows: z.array(canonicalRowSchema).max(MAX_BULK_ROWS),
});

/** The template's field definitions, for the client mapping UI. */
router.get("/batch-imports/fields", requireAuth, requireProfessional, (_req, res) => {
  res.json({
    fields: BULK_FIELDS.map((f) => ({ key: f.key, label: f.label, required: f.required })),
    maxRows: MAX_BULK_ROWS,
  });
});

/** Downloadable CSV template whose header row matches the canonical fields. */
router.get("/batch-imports/template", requireAuth, requireProfessional, (_req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="meaningbridge-patient-template.csv"');
  res.send(buildTemplateCsv());
});

/** Parse an uploaded CSV/XLSX into headers + rows and suggest a column mapping. */
router.post(
  "/batch-imports/parse",
  requireAuth,
  requireProfessional,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Please choose a .csv or .xlsx file to upload." });
      return;
    }
    try {
      const { headers, rows } = await parseSpreadsheet(req.file.buffer, req.file.originalname);
      if (rows.length === 0) {
        res.status(400).json({ error: "That file has no data rows." });
        return;
      }
      // An optional EHR export preset augments the column matcher so a known
      // vendor export maps itself with no manual column matching.
      const preset = getCsvPreset(
        typeof req.body?.preset === "string" ? req.body.preset : undefined,
      );

      // Do not record the provider-supplied filename verbatim — it can carry
      // patient identifiers. The row count is enough for the audit trail.
      await audit(req, "batch.parse", {
        detail: `${rows.length} rows parsed${preset ? ` (${preset.system} preset)` : ""}`,
      });
      res.json({
        filename: req.file.originalname,
        source: /\.xlsx$/i.test(req.file.originalname) ? "xlsx" : "csv",
        headers,
        rows,
        suggestedMapping: suggestMapping(headers, preset?.aliases),
        preset: preset ? { system: preset.system, label: preset.label } : null,
      });
    } catch (err) {
      if (err instanceof BulkImportError) {
        res.status(400).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

/** Validate already-mapped canonical rows and return a per-row report. */
router.post("/batch-imports/validate", requireAuth, requireProfessional, async (req, res) => {
  const parsed = rowsInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid rows", details: parsed.error.issues });
    return;
  }
  const result = validateRows(parsed.data.rows as CanonicalRow[]);
  res.json({
    report: result.report,
    acceptedCount: result.acceptedCount,
    rejectedCount: result.rejectedCount,
  });
});

/** Commit: enroll every accepted row (patient + consent invite) and log the run. */
router.post("/batch-imports/commit", requireAuth, requireProfessional, async (req, res) => {
  const parsed = commitInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid import", details: parsed.error.issues });
    return;
  }
  const { filename, source, preset, rows } = parsed.data;
  const presetDef = getCsvPreset(preset);
  // Tag the persisted run with its EHR origin when it came in via a preset.
  const recordedSource = presetDef ? `ehr:${presetDef.system}` : source;

  // Re-validate server-side — the client preview is never the only guard.
  const result = validateRows(rows as CanonicalRow[]);

  const [provider] = await db
    .select({ fullName: providersTable.fullName })
    .from(providersTable)
    .where(eq(providersTable.userId, req.userId!))
    .limit(1);
  const providerName = provider?.fullName ?? null;
  const origin = appOrigin(req);

  // Enroll each accepted row through the shared helper (one source of truth with
  // single-intake). Invites are dispatched fire-and-forget inside the helper —
  // this stands in for a background job queue, which this pilot does not run.
  //
  // Each enrollment runs in its own try/catch so a single failed insert cannot
  // abort the whole batch and leave partially-created patients with no import
  // log. A row that fails to enroll is downgraded to a rejection in the report,
  // so the persisted counts and the response always reconcile with reality.
  const finalReport = result.report.map((r) => ({ ...r }));
  let acceptedIdx = 0;
  let enrolledCount = 0;
  for (const entry of finalReport) {
    if (!entry.ok) continue;
    const row = result.accepted[acceptedIdx++]!;
    try {
      const { patientId } = await enrollInvitedPatient({
        providerUserId: req.userId!,
        firstName: row.firstName,
        lastName: row.lastName || null,
        dob: row.dob || null,
        email: row.email,
        phone: row.phone || null,
        pronouns: row.pronouns || null,
        providerName,
        origin,
        log: req.log,
      });
      await audit(req, "patient.create", { detail: `patient ${patientId} via bulk import` });
      enrolledCount += 1;
    } catch (err) {
      req.log.error({ err, row: entry.row }, "bulk import: row enrollment failed");
      entry.ok = false;
      entry.reason = "Could not enroll — please try this row again.";
    }
  }
  const rejectedCount = finalReport.length - enrolledCount;

  // Persist a minimal, PHI-light report (row number + accept/reject reason only;
  // names are shown in the UI response but never stored).
  const storedReport = finalReport.map((r) => ({ row: r.row, ok: r.ok, reason: r.reason }));
  const [logRow] = await db
    .insert(batchImportsTable)
    .values({
      providerUserId: req.userId!,
      filename: filename ?? null,
      source: recordedSource,
      totalRows: rows.length,
      acceptedRows: enrolledCount,
      rejectedRows: rejectedCount,
      report: storedReport,
    })
    .returning();

  await audit(req, "batch.commit", {
    detail: `${enrolledCount}/${rows.length} enrolled`,
  });

  res.status(201).json({
    import: toBatchImportView(logRow!),
    report: finalReport,
    acceptedCount: enrolledCount,
    rejectedCount,
  });
});

router.get("/batch-imports", requireAuth, requireProfessional, async (req, res) => {
  const rows = await db
    .select()
    .from(batchImportsTable)
    .where(eq(batchImportsTable.providerUserId, req.userId!))
    .orderBy(desc(batchImportsTable.createdAt));
  res.json(rows.map(toBatchImportView));
});

router.get("/batch-imports/:id", requireAuth, requireProfessional, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(batchImportsTable)
    .where(and(eq(batchImportsTable.id, id), eq(batchImportsTable.providerUserId, req.userId!)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toBatchImportView(row));
});

export default router;
