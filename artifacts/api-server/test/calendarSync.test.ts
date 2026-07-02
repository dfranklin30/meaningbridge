import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit coverage for the calendar-sync seam's failure surfacing:
 *   - resolveWritableCalendarId falls back to primary when the saved choice is
 *     no longer writable, so a stale/deleted calendar never fails silently.
 *   - describeCalendarSyncError turns a Google refusal into a calm, specific
 *     provider-facing sentence (lost access vs. deleted vs. transient).
 *
 * The Replit connectors SDK is mocked so no real Google call is made; each test
 * drives the proxy response the calendar list would return.
 */

const proxyMock = vi.fn();

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = proxyMock;
    listConnections = vi.fn().mockResolvedValue([{ id: "conn" }]);
  },
}));

function calendarListResponse(
  items: Array<{ id: string; summary?: string; primary?: boolean }>,
) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items }),
    text: async () => JSON.stringify({ items }),
  };
}

afterEach(() => {
  proxyMock.mockReset();
});

describe("resolveWritableCalendarId", () => {
  it("keeps the chosen calendar when it is still writable", async () => {
    proxyMock.mockResolvedValueOnce(
      calendarListResponse([
        { id: "primary", primary: true },
        { id: "work@group.calendar.google.com", summary: "Work" },
      ]),
    );
    const { resolveWritableCalendarId } = await import("../src/lib/calendarSync");
    const resolved = await resolveWritableCalendarId("work@group.calendar.google.com");
    expect(resolved).toEqual({ calendarId: "work@group.calendar.google.com", fellBack: false });
  });

  it("falls back to the primary calendar when the chosen one is gone", async () => {
    proxyMock.mockResolvedValueOnce(
      calendarListResponse([{ id: "primary", primary: true, summary: "Me" }]),
    );
    const { resolveWritableCalendarId } = await import("../src/lib/calendarSync");
    const resolved = await resolveWritableCalendarId("deleted@group.calendar.google.com");
    expect(resolved).toEqual({ calendarId: "primary", fellBack: true });
  });

  it("does not second-guess the choice when the writable list cannot be fetched", async () => {
    proxyMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "server error",
    });
    const { resolveWritableCalendarId } = await import("../src/lib/calendarSync");
    const resolved = await resolveWritableCalendarId("work@group.calendar.google.com");
    expect(resolved).toEqual({ calendarId: "work@group.calendar.google.com", fellBack: false });
  });
});

describe("describeCalendarSyncError", () => {
  it("explains lost write access (403)", async () => {
    const { describeCalendarSyncError, CalendarSyncError } = await import(
      "../src/lib/calendarSync"
    );
    const msg = describeCalendarSyncError(new CalendarSyncError("nope", 403));
    expect(msg).toMatch(/no longer has permission/i);
  });

  it("explains a deleted / missing calendar (404)", async () => {
    const { describeCalendarSyncError, CalendarSyncError } = await import(
      "../src/lib/calendarSync"
    );
    const msg = describeCalendarSyncError(new CalendarSyncError("gone", 404));
    expect(msg).toMatch(/could not be found/i);
  });

  it("degrades to a calm generic message for anything else", async () => {
    const { describeCalendarSyncError } = await import("../src/lib/calendarSync");
    const msg = describeCalendarSyncError(new Error("network blip"));
    expect(msg).toMatch(/could not be added/i);
    expect(msg).toMatch(/emailed to your patient/i);
  });
});
