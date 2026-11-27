import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
}));

vi.mock("../lib/aiGateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/aiGateway")>();
  return {
    ...actual,
    aiGateway: {
      generate: mockGenerate,
      isAvailable: true,
      getCacheStats: () => ({ cacheSize: 0 }),
    },
  };
});

import quizRouter, { resetQuizRateLimits } from "./quiz";
import { AIGatewayError } from "../lib/aiGateway";

const app = express();
app.use(express.json());
app.use("/api", quizRouter);

const VALID_PASSAGE =
  "The ancient library stood quiet in the golden evening light. Shelves of weathered leather books " +
  "stretched from floor to ceiling, filled with forgotten histories and timeless philosophy. " +
  "Every chapter offered a new discovery for curious minds willing to pause and reflect on the lessons of the past.";

const VALID_QUIZ_JSON = JSON.stringify({
  complexityIndex: 2.8,
  questions: [
    {
      type: "recall",
      prompt: "When did the ancient library stand quiet?",
      options: [
        "In the golden evening light",
        "During a thunderstorm at dawn",
        "At midnight during winter",
        "Under the harsh midday sun",
      ],
      correctIndex: 0,
      evidenceQuote: "The ancient library stood quiet in the golden evening light.",
      explanation: "The opening sentence directly sets the scene in the evening light.",
      isOpenEnded: false,
    },
    {
      type: "recall",
      prompt: "What filled the weathered leather books on the shelves?",
      options: [
        "Modern cookbooks and travel guides",
        "Forgotten histories and timeless philosophy",
        "Blank pages for visitors",
        "Financial ledgers and maps",
      ],
      correctIndex: 1,
      evidenceQuote: "filled with forgotten histories and timeless philosophy.",
      explanation: "The passage specifically mentions histories and philosophy.",
      isOpenEnded: false,
    },
    {
      type: "vocabulary",
      prompt: "In this passage, 'weathered' most nearly means:",
      options: [
        "Brand new and glossy",
        "Worn and aged by time",
        "Painted with bright colors",
        "Recently repaired",
      ],
      correctIndex: 1,
      evidenceQuote: "Shelves of weathered leather books",
      explanation: "Here 'weathered' evokes age and long use of the leather covers.",
      isOpenEnded: false,
    },
    {
      type: "inference",
      prompt: "What quality does the passage suggest helps readers gain the most from these books?",
      options: [
        "Reading as quickly as possible",
        "Curiosity and willingness to pause and reflect",
        "Memorizing every page number",
        "Reading only recent editions",
      ],
      correctIndex: 1,
      evidenceQuote: "curious minds willing to pause and reflect on the lessons of the past.",
      explanation: "The author links discovery with curiosity and deliberate reflection.",
      isOpenEnded: false,
    },
    {
      type: "reflection",
      prompt: "What kind of quiet place helps you focus best when reading something challenging?",
      isOpenEnded: true,
    },
  ],
});

describe("Quiz routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQuizRateLimits();
  });

  it("rejects passages that are too short with TEXT_TOO_SHORT", async () => {
    const res = await request(app)
      .post("/api/quiz/generate")
      .send({ segmentText: "Too short." })
      .expect(400);

    expect(res.body.code).toBe("TEXT_TOO_SHORT");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns validated 5-question quiz and disables raw gateway caching", async () => {
    mockGenerate.mockResolvedValueOnce({
      text: VALID_QUIZ_JSON,
      cached: false,
      inputTokens: 100,
      outputTokens: 300,
      purpose: "quiz",
    });

    const res = await request(app)
      .post("/api/quiz/generate")
      .send({ segmentText: VALID_PASSAGE, readingLevel: "intermediate" })
      .expect(200);

    expect(res.body.questions).toHaveLength(5);
    expect(res.body.complexityIndex).toBe(2.8);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "quiz",
        responseMimeType: "application/json",
        cacheTtlMs: 0,
      }),
    );

    // Second identical request should be served from validated cache without another AI call
    const cachedRes = await request(app)
      .post("/api/quiz/generate")
      .send({ segmentText: VALID_PASSAGE, readingLevel: "intermediate" })
      .expect(200);
    expect(cachedRes.body.questions).toHaveLength(5);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("returns 503 GEMINI_NOT_CONFIGURED instead of a fake quiz when Gemini is unavailable", async () => {
    mockGenerate.mockRejectedValueOnce(
      new AIGatewayError("No client", "no_client"),
    );

    const res = await request(app)
      .post("/api/quiz/generate")
      .send({ segmentText: VALID_PASSAGE })
      .expect(503);

    expect(res.body.code).toBe("GEMINI_NOT_CONFIGURED");
    expect(res.body.questions).toBeUndefined();
  });

  it("returns 429 GEMINI_RATE_LIMITED when upstream quota is exhausted", async () => {
    mockGenerate.mockRejectedValueOnce(
      new AIGatewayError("Rate limited", "api_error", { status: 429 }),
    );

    const res = await request(app)
      .post("/api/quiz/generate")
      .send({ segmentText: VALID_PASSAGE })
      .expect(429);

    expect(res.body.code).toBe("GEMINI_RATE_LIMITED");
  });

  it("retries once on malformed JSON and returns 502 GEMINI_INVALID_RESPONSE if retry also fails", async () => {
    mockGenerate
      .mockResolvedValueOnce({
        text: "{not valid json",
        cached: false,
        inputTokens: 50,
        outputTokens: 10,
        purpose: "quiz",
      })
      .mockResolvedValueOnce({
        text: "{still not valid json",
        cached: false,
        inputTokens: 50,
        outputTokens: 10,
        purpose: "quiz",
      });

    const res = await request(app)
      .post("/api/quiz/generate")
      .send({ segmentText: VALID_PASSAGE })
      .expect(502);

    expect(res.body.code).toBe("GEMINI_INVALID_RESPONSE");
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("evaluates reflection gracefully and returns score + feedback", async () => {
    mockGenerate.mockResolvedValueOnce({
      text: JSON.stringify({ score: 3, feedback: "Great personal connection to the passage!" }),
      cached: false,
      inputTokens: 40,
      outputTokens: 20,
      purpose: "quiz",
    });

    const res = await request(app)
      .post("/api/quiz/reflection")
      .send({
        answer: "Reading in a quiet park helps me reflect without checking my phone.",
        questionPrompt: "Where do you focus best?",
        segmentText: VALID_PASSAGE,
      })
      .expect(200);

    expect(res.body.score).toBe(3);
    expect(res.body.feedback).toContain("Great");
  });
});
