import { describe, expect, it } from "vitest";
import { parseQuizResponse, QuizFormatError } from "./quizValidation";

const validQuiz = {
  questions: [
    {
      type: "recall",
      prompt: "What happened first?",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      evidenceQuote: "A short quote.",
      isOpenEnded: false,
    },
    {
      type: "recall",
      prompt: "Who was present?",
      options: ["A", "B", "C", "D"],
      correctIndex: 1,
      evidenceQuote: "Another short quote.",
      isOpenEnded: false,
    },
    {
      type: "vocabulary",
      prompt: "What does the word mean here?",
      options: ["A", "B", "C", "D"],
      correctIndex: 2,
      evidenceQuote: "The word appears here.",
      isOpenEnded: false,
    },
    {
      type: "inference",
      prompt: "What can the reader infer?",
      options: ["A", "B", "C", "D"],
      correctIndex: 3,
      evidenceQuote: "This supports the inference.",
      isOpenEnded: false,
    },
    {
      type: "reflection",
      prompt: "What do you think?",
      isOpenEnded: true,
    },
  ],
};

describe("parseQuizResponse", () => {
  it("accepts the expected quiz shape", () => {
    expect(parseQuizResponse(JSON.stringify(validQuiz))).toEqual(validQuiz);
  });

  it("accepts JSON wrapped in a markdown fence", () => {
    expect(parseQuizResponse(`\`\`\`json\n${JSON.stringify(validQuiz)}\n\`\`\``)).toEqual(validQuiz);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseQuizResponse("{not-json")).toThrow(QuizFormatError);
  });

  it("rejects duplicate options and incomplete quizzes", () => {
    const duplicateOptions = structuredClone(validQuiz);
    duplicateOptions.questions[0].options = ["A", "A", "C", "D"];

    expect(() => parseQuizResponse(JSON.stringify(duplicateOptions))).toThrow(
      "four unique options",
    );
    expect(() =>
      parseQuizResponse(JSON.stringify({ questions: validQuiz.questions.slice(0, 4) })),
    ).toThrow("exactly five questions");
  });
});