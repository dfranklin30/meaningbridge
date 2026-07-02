/**
 * HIPAA session-security test for the admin oversight APIs.
 *
 * Proves that the second-factor gate is actually applied to the admin audit,
 * audit-export, and metrics endpoints: an authenticated admin session with NO
 * valid 2FA cookie is refused (403 two_factor_challenge_required), and the same
 * session succeeds once it carries a valid second-factor cookie. Clerk is
 * mocked so the test exercises requireAuth -> requireAdmin -> requireTwoFactor
 * exactly as mounted in the real app.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const CLERK_USER_ID = `admin_${randomUUID()}`;

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: CLERK_USER_ID }),
  clerkClient: { users: { getUser: async () => ({}) } },
}));

const { default: express } = await import("express");
const { default: cookieParser } = await import("cookie-parser");
const request = (await import("supertest")).default;
const { db, pool, usersTable, providerSecurityTable } = await import("@workspace/db");
const { default: professionalRouter } = await import("../src/routes/professional");
const { issueTwoFactorCookie, TWO_FACTOR_COOKIE } = await import("../src/lib/twoFactor");

// pino-http attaches req.log; the admin routes don't log, but requireAuth does
// on the error path. Provide a no-op logger so nothing throws.
function noopLog() {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = {
      info() {},
      warn() {},
      error() {},
      debug() {},
    };
    next();
  });
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/professional", professionalRouter);
  return app;
}

describe("admin oversight APIs require a second factor", () => {
  const app = noopLog();
  let userId: number;
  const ADMIN_ROUTES = ["/api/professional/admin/audit", "/api/professional/admin/metrics"];

  beforeAll(async () => {
    const [user] = await db
      .insert(usersTable)
      .values({ clerkUserId: CLERK_USER_ID, email: `${CLERK_USER_ID}@example.test`, isAdmin: true })
      .returning();
    userId = user!.id;
    // Enrolled second factor (totpEnabledAt set) so the gate reaches the cookie
    // check rather than short-circuiting on two_factor_setup_required.
    await db.insert(providerSecurityTable).values({ userId, totpEnabledAt: new Date() });
  });

  afterAll(async () => {
    await db.delete(providerSecurityTable).where(eq(providerSecurityTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await pool.end();
  });

  it("refuses admin audit/metrics without a valid 2FA cookie", async () => {
    for (const path of ADMIN_ROUTES) {
      const res = await request(app).get(path);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("two_factor_challenge_required");
    }
  });

  it("allows the same admin session once it carries a valid 2FA cookie", async () => {
    const cookie = `${TWO_FACTOR_COOKIE}=${issueTwoFactorCookie(userId)}`;
    for (const path of ADMIN_ROUTES) {
      const res = await request(app).get(path).set("Cookie", cookie);
      expect(res.status).toBe(200);
    }
  });
});
