import Papa from "papaparse";
import ExcelJS from "exceljs";

/**
 * Bulk patient import (CSV / XLSX) — parsing, the downloadable template, and
 * per-row validation. Only the identity subset of the intake is bulk-uploaded:
 * a provider enrolls many clients at once and each receives a consent invite,
 * then richer clinical intake is completed per-patient afterwards. Loss and
 * clinical screening are intentionally NOT bulk fields — they would need the
 * per-row safety gate that only the single intake flow performs.
 */

/** Hard cap on rows accepted in one upload (pilot-scale safety limit). */
export const MAX_BULK_ROWS = 500;

/** A canonical bulk-import field the provider maps their columns onto. */
export interface BulkField {
  key: keyof CanonicalRow;
  label: string;
  required: boolean;
  /** Lowercased header spellings auto-mapped to this field. */
  aliases: string[];
}

export interface CanonicalRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  pronouns: string;
}

export const BULK_FIELDS: BulkField[] = [
  { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "first", "given name", "givenname"] },
  { key: "lastName", label: "Last name", required: false, aliases: ["last name", "lastname", "last", "surname", "family name", "familyname"] },
  { key: "email", label: "Email", required: true, aliases: ["email", "email address", "e-mail", "mail"] },
  { key: "phone", label: "Phone", required: false, aliases: ["phone", "phone number", "mobile", "cell", "telephone", "tel"] },
  { key: "dob", label: "Date of birth", required: false, aliases: ["dob", "date of birth", "birth date", "birthdate", "birthday"] },
  { key: "pronouns", label: "Pronouns", required: false, aliases: ["pronouns", "pronoun"] },
];

export class BulkImportError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isXlsx(filename: string): boolean {
  return /\.xlsx$/i.test(filename);
}

function isCsv(filename: string): boolean {
  return /\.csv$/i.test(filename);
}

/** Parse an uploaded CSV or XLSX buffer into headers + string-keyed rows. */
export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  if (isCsv(filename)) return parseCsv(buffer);
  if (isXlsx(filename)) return parseXlsx(buffer);
  throw new BulkImportError("Please upload a .csv or .xlsx file.", "unsupported_type");
}

function parseCsv(buffer: Buffer): ParsedSheet {
  const text = buffer.toString("utf8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields ?? []).map((h) => h.trim()).filter((h) => h.length > 0);
  const rows = (result.data ?? []).map((r) => normalizeRow(r, headers));
  return capRows({ headers, rows });
}

async function parseXlsx(buffer: Buffer): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  // exceljs accepts a Node Buffer where its types expect an ArrayBuffer.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BulkImportError("The spreadsheet has no sheets.", "empty_file");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cell.value ?? "").trim());
  });
  const cleanHeaders = headers.filter((h) => h.length > 0);

  const rows: Record<string, string>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    cleanHeaders.forEach((header, i) => {
      const cell = row.getCell(i + 1);
      const value = cellText(cell.value);
      if (value.length > 0) hasValue = true;
      record[header] = value;
    });
    if (hasValue) rows.push(record);
  });

  return capRows({ headers: cleanHeaders, rows });
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const obj = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof obj.text === "string") return obj.text.trim();
    if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text).join("").trim();
    if (obj.result !== undefined) return String(obj.result).trim();
  }
  return String(value).trim();
}

function normalizeRow(row: Record<string, string>, headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) out[h] = String(row[h] ?? "").trim();
  return out;
}

function capRows(sheet: ParsedSheet): ParsedSheet {
  if (sheet.rows.length > MAX_BULK_ROWS) {
    throw new BulkImportError(
      `This file has ${sheet.rows.length} rows. Please upload at most ${MAX_BULK_ROWS} at a time.`,
      "too_many_rows",
    );
  }
  return sheet;
}

/**
 * Suggest an initial header -> canonical-field mapping by fuzzy header match.
 *
 * `extraAliases` (from an EHR CSV export preset) augments — never replaces — the
 * default aliases, so a known vendor export maps itself while a hand-edited file
 * still matches on the built-in spellings.
 */
export function suggestMapping(
  headers: string[],
  extraAliases?: Partial<Record<keyof CanonicalRow, string[]>>,
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of BULK_FIELDS) {
    const aliases = new Set([
      ...field.aliases,
      ...(extraAliases?.[field.key]?.map((a) => a.trim().toLowerCase()) ?? []),
    ]);
    const match = headers.find((h) => {
      const lower = h.trim().toLowerCase();
      return !used.has(h) && (lower === field.key.toLowerCase() || aliases.has(lower));
    });
    if (match) {
      mapping[field.key] = match;
      used.add(match);
    }
  }
  return mapping;
}

export interface RowReport {
  row: number;
  ok: boolean;
  reason?: string;
  /** First name for the provider to identify the row in the UI (not persisted). */
  name: string | null;
}

export interface ValidationResult {
  report: RowReport[];
  accepted: CanonicalRow[];
  acceptedCount: number;
  rejectedCount: number;
}

/**
 * Validate already-mapped canonical rows. firstName and a well-formed email are
 * required; a duplicate email within the same file is rejected (each accepted
 * email receives exactly one invite). Cross-patient dedup is impossible here —
 * stored emails are encrypted and not queryable — so it is out of scope.
 */
export function validateRows(rows: CanonicalRow[]): ValidationResult {
  const report: RowReport[] = [];
  const accepted: CanonicalRow[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((raw, i) => {
    const row: CanonicalRow = {
      firstName: raw.firstName?.trim() ?? "",
      lastName: raw.lastName?.trim() ?? "",
      email: raw.email?.trim() ?? "",
      phone: raw.phone?.trim() ?? "",
      dob: raw.dob?.trim() ?? "",
      pronouns: raw.pronouns?.trim() ?? "",
    };
    const rowNo = i + 1;
    const name = row.firstName || null;

    let reason: string | null = null;
    if (!row.firstName) reason = "Missing first name";
    else if (!row.email) reason = "Missing email";
    else if (!EMAIL_RE.test(row.email)) reason = "Invalid email address";
    else if (seenEmails.has(row.email.toLowerCase())) reason = "Duplicate email in this file";

    if (reason) {
      report.push({ row: rowNo, ok: false, reason, name });
    } else {
      seenEmails.add(row.email.toLowerCase());
      accepted.push(row);
      report.push({ row: rowNo, ok: true, name });
    }
  });

  const acceptedCount = accepted.length;
  return { report, accepted, acceptedCount, rejectedCount: report.length - acceptedCount };
}

/** Build the downloadable CSV template (header row only, canonical order). */
export function buildTemplateCsv(): string {
  const headers = BULK_FIELDS.map((f) => f.label);
  return headers.join(",") + "\r\n";
}
