import { describe, expect, it } from "vitest";
import {
  codeMatches,
  generateCode,
  hashCode,
  maskPhone,
  normalizePhone,
} from "../src/lib/phoneVerification";

/**
 * Pure-function tests for phone verification. Normalization is the gate that
 * keeps us from ever texting a number we cannot reach, and the code is only ever
 * compared by hash — never stored or logged in the clear.
 */
describe("phone verification helpers", () => {
  it("normalizes 10-digit US numbers to E.164 (+1)", () => {
    expect(normalizePhone("555 123 4567")).toBe("+15551234567");
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("keeps an already-plus-prefixed international number", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });

  it("accepts an 11-digit number that starts with 1", () => {
    expect(normalizePhone("1-555-123-4567")).toBe("+15551234567");
  });

  it("rejects numbers that cannot be a mobile number", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("abcdefghij")).toBeNull();
    expect(normalizePhone("+12")).toBeNull();
  });

  it("masks all but the last four digits for display", () => {
    expect(maskPhone("+15551234567")).toBe("••• ••• 4567");
  });

  it("generates a 6-digit zero-padded code", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("matches a code only against its own hash", () => {
    const code = "042195";
    const hash = hashCode(code);
    expect(codeMatches(code, hash)).toBe(true);
    expect(codeMatches(" 042195 ", hash)).toBe(true);
    expect(codeMatches("000000", hash)).toBe(false);
    expect(codeMatches(code, null)).toBe(false);
  });
});
