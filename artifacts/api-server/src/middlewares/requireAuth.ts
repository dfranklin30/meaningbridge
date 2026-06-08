import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Local application user row (Clerk-backed identity, mirrored locally). */
      appUser?: User;
      /** Local integer user id used to scope all owned data. */
      userId?: number;
    }
  }
}

/**
 * Authentication gate. Resolves the Clerk session, then looks up (or
 * just-in-time provisions) the local `users` row keyed by the Clerk user id.
 * Sets `req.userId` (local integer id) and `req.appUser` for downstream
 * handlers so every query can be scoped to the current account.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));

    if (!user) {
      let email: string | null = null;
      let firstName: string | null = null;
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        email =
          clerkUser.primaryEmailAddress?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          null;
        firstName = clerkUser.firstName ?? null;
      } catch (err) {
        req.log.warn({ err: String(err) }, "could not fetch Clerk user details during provisioning");
      }

      [user] = await db
        .insert(usersTable)
        .values({ clerkUserId, email, firstName })
        .onConflictDoNothing({ target: usersTable.clerkUserId })
        .returning();

      if (!user) {
        // Lost a provisioning race; re-read the row created by the other request.
        [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
      }
    }

    if (!user) {
      res.status(500).json({ error: "Could not resolve account" });
      return;
    }

    req.appUser = user;
    req.userId = user.id;
    next();
  } catch (err) {
    req.log.error({ err }, "requireAuth failed");
    res.status(500).json({ error: "Auth resolution failed" });
  }
}
