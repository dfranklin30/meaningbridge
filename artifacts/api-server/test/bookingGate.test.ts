import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkBookingEligibility } from "../src/lib/bookingGate";
import { HealthieNotConfiguredError } from "../src/lib/healthie";

/**
 * Booking-gate deny-by-default invariants. A clinical gate must fail closed: no
 * booking until the required intake/consent forms are demonstrably signed. These
 * cases hold WITHOUT a live Healthie key — they exercise the safe posture that
 * protects seekers before any external call is made.
 */
describe("checkBookingEligibility deny-by-default", () => {
  const savedRequired = process.env.HEALTHIE_REQUIRED_FORM_IDS;
  const savedKey = process.env.HEALTHIE_API_KEY;

  beforeEach(() => {
    delete process.env.HEALTHIE_REQUIRED_FORM_IDS;
    delete process.env.HEALTHIE_API_KEY;
  });

  afterEach(() => {
    if (savedRequired === undefined) delete process.env.HEALTHIE_REQUIRED_FORM_IDS;
    else process.env.HEALTHIE_REQUIRED_FORM_IDS = savedRequired;
    if (savedKey === undefined) delete process.env.HEALTHIE_API_KEY;
    else process.env.HEALTHIE_API_KEY = savedKey;
  });

  it("denies when no gating forms are configured (never calls Healthie)", async () => {
    const result = await checkBookingEligibility("healthie-user-1");
    expect(result.allowed).toBe(false);
    expect(result.missingFormIds).toEqual([]);
  });

  it("treats blank/comma-only config as no forms configured → denied", async () => {
    process.env.HEALTHIE_REQUIRED_FORM_IDS = " , , ";
    const result = await checkBookingEligibility("healthie-user-1");
    expect(result.allowed).toBe(false);
    expect(result.missingFormIds).toEqual([]);
  });

  it("surfaces not-configured (→ 503) when forms are required but no key is set", async () => {
    process.env.HEALTHIE_REQUIRED_FORM_IDS = "form-a,form-b";
    await expect(checkBookingEligibility("healthie-user-1")).rejects.toBeInstanceOf(
      HealthieNotConfiguredError,
    );
  });
});
