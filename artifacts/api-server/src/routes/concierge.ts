import { Router, type IRouter } from "express";
import { SendConciergeMessageBody } from "@workspace/api-zod";
import { publicConciergeSystemPrompt } from "../lib/prompts";
import { streamStatelessChat } from "../lib/streamChat";

const router: IRouter = Router();

/**
 * Public product concierge for the always-on corner bubble on marketing /
 * logged-out pages. Unauthenticated by design, stateless, and firewalled from
 * any patient or clinical content by its system prompt.
 */
router.post("/message", async (req, res) => {
  const body = SendConciergeMessageBody.parse(req.body);
  await streamStatelessChat({
    res,
    system: publicConciergeSystemPrompt(),
    messages: body.messages,
    log: req.log,
  });
});

export default router;
