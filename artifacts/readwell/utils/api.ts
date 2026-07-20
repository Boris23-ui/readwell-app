const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

export async function extractTextFromFile(
  file: File,
): Promise<{ text: string; suggestedTitle: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/api/extract-text`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to extract text');
  }

  return response.json();
}

export async function generateQuiz(
  segmentText: string,
  readingLevel: string,
): Promise<{ questions: any[] }> {
  const response = await fetch(`${BASE_URL}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segmentText, readingLevel }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to generate quiz');
  }
  return response.json();
}
