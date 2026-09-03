import { Router, type Request } from "express";
import { createHash } from "crypto";
import { logger } from "../lib/logger";
import { aiGateway } from "../lib/aiGateway";

const router = Router();

const MAX_PASSAGE_CHARS = 12_000;

router.post("/simplify", async (req, res) => {
  const body = req.body as {
    segmentText?: unknown;
    targetLevel?: unknown;
  };
  const segmentText = body.segmentText;
  const targetLevel = String(body.targetLevel || "beginner");

  if (typeof segmentText !== "string" || segmentText.trim().length === 0) {
    res.status(400).json({
      error: "segmentText is required",
      code: "TEXT_REQUIRED",
    });
    return;
  }

  const passage = segmentText.trim();
  if (passage.length > MAX_PASSAGE_CHARS) {
    res.status(413).json({
      error: `segmentText must be ${MAX_PASSAGE_CHARS} characters or fewer`,
      code: "TEXT_TOO_LONG",
    });
    return;
  }

  // Build cache key from passage + target level
  const passageHash = createHash("sha256")
    .update(`${passage}:${targetLevel}`)
    .digest("hex")
    .slice(0, 16);

  const systemInstruction = `You are an expert reading tutor. Rewrite the provided passage to match the ${targetLevel} reading level, making it easier to comprehend while preserving the core meaning and facts. Return a JSON object with a single "text" field containing the rewritten passage.`;

  const prompt = `PASSAGE:\n${passage.slice(0, MAX_PASSAGE_CHARS)}`;

  try {
    const result = await aiGateway.generate({
      purpose: 'simplify',
      priority: 'standard',
      cacheKey: `simplify:${passageHash}`,
      cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours — simplified text doesn't change
      prompt,
      systemInstruction,
      maxOutputTokens: 2500,
      fallbackFn: () => JSON.stringify({
        text: "This section has been marked for simplification. The AI simplification service is temporarily unavailable — please try again in a few minutes, or continue reading the original text.",
      }),
    });

    const parsed = JSON.parse(result.text);
    if (typeof parsed.text === "string") {
      res.json({ text: parsed.text });
    } else if (typeof parsed === "string") {
      res.json({ text: parsed });
    } else {
      res.json({ text: result.text });
    }
  } catch (err) {
    logger.error({ err }, "Simplification error");
    res.status(503).json({
      error: "Failed to simplify text.",
      code: "SIMPLIFY_ERROR",
    });
  }
});

export default router;

