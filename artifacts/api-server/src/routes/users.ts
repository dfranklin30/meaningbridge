import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import { UpdateMeBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serializeMe(u: User) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    role: u.role,
    isSeeker: u.isSeeker,
    isProfessional: u.isProfessional,
    activeSpace: u.activeSpace,
    isAdmin: u.isAdmin,
  };
}

// requireAuth is applied per-route (not router-level) because this router is
// mounted at the root path; router-level middleware here would leak onto every
// sibling router, including public ones.
router.get("/me", requireAuth, (req, res) => {
  res.json(serializeMe(req.appUser!));
});

router.patch("/me", requireAuth, async (req, res) => {
  const body = UpdateMeBody.parse(req.body);
  const current = req.appUser!;

  // Capabilities are additive. Start from what the account already has, then
  // apply grants. `roles` sets the full capability set; the legacy `role`
  // shortcut grants a single capability without revoking the other.
  let isSeeker = current.isSeeker;
  let isProfessional = current.isProfessional;

  if (body.roles) {
    isSeeker = body.roles.includes("seeker");
    isProfessional = body.roles.includes("professional");
  }
  if (body.role === "seeker") isSeeker = true;
  if (body.role === "professional") isProfessional = true;

  // Resolve the active space, preferring an explicit request, then the legacy
  // `role` shortcut, then whatever is already active. Never leave `activeSpace`
  // pointing at a capability the account does not hold.
  let activeSpace: "seeker" | "professional" | null =
    body.activeSpace ??
    body.role ??
    (current.activeSpace as "seeker" | "professional" | null) ??
    null;
  if (activeSpace === "professional" && !isProfessional) {
    activeSpace = isSeeker ? "seeker" : null;
  }
  if (activeSpace === "seeker" && !isSeeker) {
    activeSpace = isProfessional ? "professional" : null;
  }
  if (!activeSpace) {
    activeSpace = isSeeker ? "seeker" : isProfessional ? "professional" : null;
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      isSeeker,
      isProfessional,
      activeSpace,
      // Keep the legacy `role` column mirroring the active space for older reads.
      role: activeSpace,
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(serializeMe(updated));
});

export default router;
