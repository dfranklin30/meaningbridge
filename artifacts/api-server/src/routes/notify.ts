import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, notifyOptInsTable } from "@workspace/db";
import { CreateNotifyOptInBody } from "@workspace/api-zod";

const router: IRouter = Router();

const NOTIFY_RECIPIENTS = [
  "remcrawfordresearch@gmail.com",
  "danielle@techleadershipcommunity.com",
  "neimeyer@memphis.edu",
  "neimeyer@portlandinstitute.org",
];

router.post("/notify", async (req, res) => {
  const body = CreateNotifyOptInBody.parse(req.body);
  const email = body.email.trim().toLowerCase();
  const roleInterest = body.roleInterest?.trim() || null;
  const source = body.source?.trim() || "qr";

  const inserted = await db
    .insert(notifyOptInsTable)
    .values({ email, roleInterest, source })
    .onConflictDoNothing({ target: notifyOptInsTable.email })
    .returning();

  if (inserted.length > 0) {
    req.log.info(
      { signupId: inserted[0].id, source, recipients: NOTIFY_RECIPIENTS },
      "notify signup recorded (email notification pending integration)",
    );
    res.json({ ok: true, alreadySubscribed: false, signup: inserted[0] });
    return;
  }

  const [existing] = await db
    .select()
    .from(notifyOptInsTable)
    .where(eq(notifyOptInsTable.email, email));

  res.json({ ok: true, alreadySubscribed: true, signup: existing });
});

router.get("/notify", async (req, res) => {
  const adminToken = process.env["NOTIFY_ADMIN_TOKEN"];
  if (!adminToken) {
    req.log.warn("GET /notify denied: NOTIFY_ADMIN_TOKEN not configured");
    res.status(403).json({ error: "Admin export not enabled." });
    return;
  }
  const provided =
    req.header("x-admin-token") ||
    (req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (provided !== adminToken) {
    res.status(403).json({ error: "Forbidden." });
    return;
  }
  const rows = await db
    .select()
    .from(notifyOptInsTable)
    .orderBy(desc(notifyOptInsTable.createdAt));
  res.json(rows);
});

export default router;
