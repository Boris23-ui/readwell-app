import { Router, type Request } from "express";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router = Router();

const MAX_PASSAGE_CHARS = 12_000;
const GEMINI_TIMEOUT_MS = 30_000;
const MAX_GENERATION_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    for (const key of ["status", "statusCode", "code"] as const) {
      if (!(key in record)) continue;
      const value = record[key];
      const status = typeof value === "number" ? value : Number(value);
      if (Number.isInteger(status) && status >= 400 && status <= 599) {
        return status;
      }
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/\b(408|429|500|502|503|504)\b/);
  if (statusMatch) return Number(statusMatch[1]);
  return undefined;
}

function getSafeErrorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 180);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function generateSimplificationWithRetry(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
): Promise<{ text: string }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      });

      const jsonText = response.text ?? "{}";
      const parsed = JSON.parse(jsonText);
      if (typeof parsed.text !== "string") {
        throw new Error("Invalid format");
      }
      return { text: parsed.text };
    } catch (error) {
      lastError = error;
      if (attempt === MAX_GENERATION_ATTEMPTS) {
        throw error;
      }
      await wait(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError ?? new Error("Generation failed");
}

router.post("/simplify", async (req, res) => {
  const body = req.body as {
    segmentText?: unknown;
    targetLevel?: unknown;
  };
  const segmentText = body.segmentText;
  const targetLevel = body.targetLevel || "beginner";

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

  const apiKey =
    (req.headers["x-gemini-api-key"] as string) ||
    ((req.body as any)?.apiKey as string) ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.info("GEMINI_API_KEY not found; generating fallback simplification");
    res.json({
      text: "This is a simplified fallback text since no API key is present. In production, this would be a rewritten passage tailored to the user's reading level."
    });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: GEMINI_TIMEOUT_MS,
        retryOptions: { attempts: 1 },
      },
    });
    const model = process.env.GEMINI_MODEL || "gemini-3.7-flash";
    const truncated = passage.slice(0, MAX_PASSAGE_CHARS);

    const prompt = `You are an expert reading tutor. Rewrite the following passage to match the ${targetLevel} reading level, making it easier to comprehend while preserving the core meaning and facts.

Return ONLY a JSON object — no markdown, no explanation, just valid JSON:
{
  "text": "The fully simplified text goes here."
}

PASSAGE:
${truncated}`;

    const parsed = await generateSimplificationWithRetry(ai, model, prompt);
    res.json(parsed);
  } catch (err) {
    const status = getErrorStatus(err);
    logger.error({ status, errorSummary: getSafeErrorSummary(err) }, "Simplification error");
    res.status(503).json({
      error: "Failed to simplify text.",
      code: "SIMPLIFY_ERROR",
    });
  }
});

export default router;
