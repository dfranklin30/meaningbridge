import { Router, type IRouter } from "express";
import multer from "multer";
import { ensureCompatibleFormat, speechToText } from "@workspace/integrations-openai-ai-server/audio";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Audio arrives as multipart/form-data, so it bypasses the global JSON body
// limit. Keep recordings small and in memory for direct hand-off to STT.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post("/transcribe", requireAuth, upload.single("audio"), async (req, res) => {
  if (!req.file || req.file.size === 0) {
    res.status(400).json({ error: "No audio provided" });
    return;
  }

  try {
    const { buffer, format } = await ensureCompatibleFormat(req.file.buffer);
    const text = await speechToText(buffer, format);
    res.json({ text: text.trim() });
  } catch (error) {
    req.log.error({ err: error }, "voice transcription failed");
    res.status(500).json({ error: "Could not transcribe audio" });
  }
});

export default router;
