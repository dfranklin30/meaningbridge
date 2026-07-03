import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { generateImageBuffer, type ImageSize } from "@workspace/integrations-openai-ai-server/image";
import { requireAuth } from "../middlewares/requireAuth";
import { moderate } from "../lib/safety";

const router: IRouter = Router();

const Body = z.object({
  prompt: z.string().trim().min(1).max(500),
  orientation: z.enum(["square", "landscape", "portrait"]).default("square"),
});

const SIZE: Record<z.infer<typeof Body>["orientation"], ImageSize> = {
  square: "1024x1024",
  landscape: "1536x1024",
  portrait: "1024x1536",
};

// A calming, abstract house style. The suffix hard-forbids any human likeness so
// the companion can never render a face or the deceased person from a photo.
const STYLE_PREFIX =
  "A gentle, calming, abstract artwork for a quiet grief reflection. Soft soothing light, peaceful and symbolic natural imagery such as open skies, still water, gardens, candlelight, or distant horizons. Muted, restful palette, painterly and serene, spacious composition.";
const SAFETY_SUFFIX =
  "Do not depict any human faces, figures, portraits, or recognizable people. No text, letters, words, watermarks, or logos.";

// Deterministic intent guard: block explicit requests for a human likeness so the
// companion can never be steered into rendering a face or the person being grieved.
// Kept narrow on likeness terms (not relationship nouns) to avoid rejecting gentle
// scene prompts like "the garden my mother loved".
const LIKENESS_PATTERN =
  /\b(faces?|portraits?|selfies?|headshots?|likeness(?:es)?|mugshots?)\b|\bwhat\s+(?:he|she|they)\s+looked\s+like\b/i;

router.post("/memory", requireAuth, async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  const { prompt, orientation } = parsed.data;

  if (LIKENESS_PATTERN.test(prompt)) {
    res.status(422).json({ error: "prompt_not_allowed" });
    return;
  }

  // Gate the user's wording through moderation. moderate() fails open (degraded),
  // and the style framing plus the model's own safety keep output gentle.
  const moderation = await moderate(prompt);
  if (moderation.flagged) {
    res.status(422).json({ error: "prompt_not_allowed" });
    return;
  }

  const finalPrompt = `${STYLE_PREFIX} The reflection is about: ${prompt}. ${SAFETY_SUFFIX}`;

  try {
    const buffer = await generateImageBuffer(finalPrompt, SIZE[orientation]);
    res.json({ b64_json: buffer.toString("base64") });
    return;
  } catch (err) {
    req.log.error({ err }, "memory image generation failed");
    res.status(502).json({ error: "generation_failed" });
    return;
  }
});

export default router;
