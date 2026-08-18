export type QuestionType = "recall" | "vocabulary" | "inference" | "reflection";

export interface Question {
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  evidenceQuote?: string;
  isOpenEnded: boolean;
}

export interface GenerateQuizResponse {
  questions: Question[];
}

export class QuizFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizFormatError";
  }
}

const EXPECTED_TYPES: QuestionType[] = [
  "recall",
  "recall",
  "vocabulary",
  "inference",
  "reflection",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseQuizResponse(raw: string): GenerateQuizResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripMarkdownFence(raw));
  } catch {
    throw new QuizFormatError("Gemini response was not valid JSON");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.questions) || parsed.questions.length !== 5) {
    throw new QuizFormatError("Gemini response did not contain exactly five questions");
  }

  const questions: Question[] = parsed.questions.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new QuizFormatError(`Question ${index + 1} was not an object`);
    }

    const type = candidate.type;
    const prompt = candidate.prompt;
    const isOpenEnded = candidate.isOpenEnded;

    if (type !== EXPECTED_TYPES[index]) {
      throw new QuizFormatError(`Question ${index + 1} had an unexpected type`);
    }
    if (!isNonEmptyString(prompt)) {
      throw new QuizFormatError(`Question ${index + 1} did not have a prompt`);
    }

    if (index === 4) {
      if (isOpenEnded !== true) {
        throw new QuizFormatError("The reflection question must be open-ended");
      }

      return {
        type: "reflection",
        prompt: prompt.trim(),
        isOpenEnded: true,
      };
    }

    if (isOpenEnded !== false) {
      throw new QuizFormatError(`Question ${index + 1} must be multiple-choice`);
    }

    const options = candidate.options;
    const correctIndex = candidate.correctIndex;
    const evidenceQuote = candidate.evidenceQuote;

    if (
      !Array.isArray(options) ||
      options.length !== 4 ||
      !options.every(isNonEmptyString) ||
      new Set(options.map((option) => option.trim().toLocaleLowerCase())).size !== 4
    ) {
      throw new QuizFormatError(`Question ${index + 1} did not have four unique options`);
    }
    if (
      typeof correctIndex !== "number" ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex > 3
    ) {
      throw new QuizFormatError(`Question ${index + 1} had an invalid correct answer index`);
    }
    if (!isNonEmptyString(evidenceQuote)) {
      throw new QuizFormatError(`Question ${index + 1} did not include evidence`);
    }

    return {
      type: EXPECTED_TYPES[index],
      prompt: prompt.trim(),
      options: options.map((option) => option.trim()),
      correctIndex,
      evidenceQuote: evidenceQuote.trim(),
      isOpenEnded: false,
    };
  });

  return { questions };
}