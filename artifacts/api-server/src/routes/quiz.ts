import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router = Router();

interface Question {
  type: "recall" | "vocabulary" | "inference" | "reflection";
  prompt: string;
  options?: string[];
  correctIndex?: number;
  evidenceQuote?: string;
  isOpenEnded: boolean;
}

interface GenerateQuizResponse {
  questions: Question[];
}

router.post("/quiz/generate", async (req, res) => {
  const { segmentText, readingLevel = "intermediate" } = req.body as {
    segmentText?: string;
    readingLevel?: string;
  };

  if (!segmentText || typeof segmentText !== "string" || segmentText.trim().length < 50) {
    res.status(400).json({ error: "segmentText is required and must be at least 50 characters", code: "TEXT_TOO_SHORT" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Google Gemini API is not configured" });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    const truncated = segmentText.slice(0, 3000);

    const prompt = `You are an expert reading comprehension teacher. Create engaging quiz questions for the passage below.

READING LEVEL: ${readingLevel}

PASSAGE:
${truncated}

Return ONLY a JSON object — no markdown, no explanation, just valid JSON:
{
  "questions": [
    {
      "type": "recall",
      "prompt": "Direct recall question about a specific fact in the passage?",
      "options": ["Correct answer from text", "Plausible but wrong A", "Plausible but wrong B", "Plausible but wrong C"],
      "correctIndex": 0,
      "evidenceQuote": "Exact phrase from passage (max 25 words)",
      "isOpenEnded": false
    },
    {
      "type": "recall",
      "prompt": "Another direct recall question about a different fact?",
      "options": ["Wrong option 1", "Wrong option 2", "Correct answer", "Wrong option 3"],
      "correctIndex": 2,
      "evidenceQuote": "Supporting phrase from the passage",
      "isOpenEnded": false
    },
    {
      "type": "vocabulary",
      "prompt": "In the passage, what does [specific word/phrase] most likely mean?",
      "options": ["Correct meaning in context", "Different meaning", "Opposite meaning", "Unrelated definition"],
      "correctIndex": 0,
      "evidenceQuote": "The sentence containing the word from the passage",
      "isOpenEnded": false
    },
    {
      "type": "inference",
      "prompt": "Inference question about something implied but not directly stated?",
      "options": ["Option A", "Option B", "Option C", "Correct inference"],
      "correctIndex": 3,
      "evidenceQuote": "Passage text that leads to this inference",
      "isOpenEnded": false
    },
    {
      "type": "reflection",
      "prompt": "What do you think about [theme or character choice from the passage]? Share your perspective.",
      "isOpenEnded": true
    }
  ]
}

RULES — all must be followed:
- Q1 and Q2: fact explicitly stated in the passage; answer must be quotable
- Q3: specific word or phrase from the passage; test contextual meaning  
- Q4: implied by the passage but not directly written
- Q5: open-ended reflection; omit options, correctIndex, evidenceQuote entirely
- All options must be plausible — no obviously silly distractors
- evidenceQuote: exact text from passage, ≤25 words
- correctIndex: 0-3 (index of the correct option)
- Questions must be specific to THIS passage — not generic comprehension questions`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? "{}";

    let parsed: GenerateQuizResponse;
    try {
      parsed = JSON.parse(text);
    } catch {
      logger.error({ text: text.slice(0, 200) }, "Failed to parse Gemini quiz response as JSON");
      res.status(500).json({ error: "Failed to parse quiz response" });
      return;
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      logger.error({ parsed }, "Invalid quiz format from Gemini");
      res.status(500).json({ error: "Invalid quiz format returned by AI" });
      return;
    }

    res.json(parsed);
  } catch (err) {
    logger.error({ err }, "Quiz generation error");
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});

export default router;
