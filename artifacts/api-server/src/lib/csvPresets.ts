import type { CanonicalRow } from "./bulkImport";

/**
 * Per-EHR CSV export presets for the bulk-upload flow. Each preset carries the
 * column-header spellings that a given practice-management system uses in its
 * client export, mapped onto our canonical bulk-import fields. When a provider
 * starts bulk upload from an integration ("Use SimplePractice export preset"),
 * these aliases are merged into the fuzzy header matcher so the export maps
 * itself with no manual column matching.
 *
 * This is intentionally additive: presets never replace the default aliases in
 * bulkImport.ts, they extend them, so a hand-edited export still maps too.
 */

export type PresetAliases = Partial<Record<keyof CanonicalRow, string[]>>;

export interface CsvPreset {
  system: string;
  label: string;
  aliases: PresetAliases;
}

/**
 * Keyed by system id (matches professionalMeta INTEGRATION_SYSTEMS csv_preset
 * entries). Header spellings are lowercased; matching is case-insensitive.
 */
export const CSV_PRESETS: Record<string, CsvPreset> = {
  simplepractice: {
    system: "simplepractice",
    label: "SimplePractice client export",
    aliases: {
      firstName: ["client first name", "legal first name", "preferred name"],
      lastName: ["client last name", "legal last name"],
      email: ["client email", "email address"],
      phone: ["mobile phone", "phone number", "primary phone"],
      dob: ["date of birth", "birth date"],
      pronouns: ["pronouns"],
    },
  },
  therapynotes: {
    system: "therapynotes",
    label: "TherapyNotes patient export",
    aliases: {
      firstName: ["patient first name", "first"],
      lastName: ["patient last name", "last"],
      email: ["email", "e-mail address"],
      phone: ["cell phone", "primary phone", "mobile"],
      dob: ["dob", "date of birth"],
    },
  },
  tebra: {
    system: "tebra",
    label: "Tebra (Kareo) patient export",
    aliases: {
      firstName: ["first name", "patient first"],
      lastName: ["last name", "patient last"],
      email: ["email address", "email"],
      phone: ["home phone", "mobile phone", "cell phone"],
      dob: ["date of birth", "birthdate"],
    },
  },
};

/** Look up a preset by system id, or null when the system has no preset. */
export function getCsvPreset(system: string | null | undefined): CsvPreset | null {
  if (!system) return null;
  return CSV_PRESETS[system] ?? null;
}
