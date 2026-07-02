/**
 * National Provider Identifier (NPI) validation.
 *
 * An NPI is a 10-digit number whose final digit is a Luhn check digit computed
 * over the string "80840" + the first 9 digits (the 80840 prefix is the ISO
 * issuer identifier CMS uses for NPIs). We validate format and checksum locally,
 * and offer a best-effort lookup against the public NPPES registry.
 */

export interface NpiValidation {
  formatValid: boolean;
  checksumValid: boolean;
  valid: boolean;
}

export function validateNpi(npi: string): NpiValidation {
  const formatValid = /^\d{10}$/.test(npi);
  const checksumValid = formatValid && npiChecksumValid(npi);
  return { formatValid, checksumValid, valid: formatValid && checksumValid };
}

function npiChecksumValid(npi: string): boolean {
  const digits = ("80840" + npi.slice(0, 9)).split("").map(Number);
  let sum = 0;
  let double = true; // rightmost prefix digit is doubled (check digit sits to its right)
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i]!;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(npi[9]);
}

export interface NpiRegistryResult {
  found: boolean;
  name?: string;
  credential?: string;
  primaryTaxonomy?: string;
  state?: string;
  enumerationType?: string;
}

/**
 * Best-effort lookup against the public NPPES registry. Never throws — returns
 * `{ found: false }` on any network error, timeout, or unexpected shape so the
 * onboarding flow degrades gracefully when the registry is unreachable.
 */
export async function lookupNpiRegistry(npi: string): Promise<NpiRegistryResult> {
  if (!/^\d{10}$/.test(npi)) return { found: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { found: false };
    const json = (await res.json()) as {
      result_count?: number;
      results?: Array<{
        enumeration_type?: string;
        basic?: {
          first_name?: string;
          last_name?: string;
          organization_name?: string;
          credential?: string;
        };
        addresses?: Array<{ address_purpose?: string; state?: string }>;
        taxonomies?: Array<{ desc?: string; primary?: boolean }>;
      }>;
    };
    const first = json.results?.[0];
    if (!json.result_count || !first) return { found: false };
    const basic = first.basic ?? {};
    const name =
      basic.organization_name ||
      [basic.first_name, basic.last_name].filter(Boolean).join(" ") ||
      undefined;
    const primary = first.taxonomies?.find((t) => t.primary) ?? first.taxonomies?.[0];
    const location = first.addresses?.find((a) => a.address_purpose === "LOCATION");
    return {
      found: true,
      name,
      credential: basic.credential || undefined,
      primaryTaxonomy: primary?.desc || undefined,
      state: location?.state || undefined,
      enumerationType: first.enumeration_type || undefined,
    };
  } catch {
    return { found: false };
  } finally {
    clearTimeout(timeout);
  }
}
