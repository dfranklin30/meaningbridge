import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateMeBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// requireAuth is applied per-route (not router-level) because this router is
// mounted at the root path; router-level middleware here would leak onto every
// sibling router, including public ones.
router.get("/me", requireAuth, (req, res) => {
  const u = req.appUser!;
  res.json({ id: u.id, email: u.email, firstName: u.firstName, role: u.role });
});

router.patch("/me", requireAuth, async (req, res) => {
  const body = UpdateMeBody.parse(req.body);
  const [updated] = await db
    .update(usersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(usersTable.id, req.userId!))
    .returning();
  res.json({
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    role: updated.role,
  });
});

export default router;
