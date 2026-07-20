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

export interface RenderedPdfPage {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
  text: string;
  ocrUsed?: boolean;
}

export interface RenderPdfResult {
  bookId: string;
  suggestedTitle: string;
  pageCount: number;
  pages: RenderedPdfPage[];
  ocrUsed?: boolean;
}

export async function renderPdf(file: File): Promise<RenderPdfResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/api/render-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to render PDF');
  }

  return response.json();
}

// Resolves a stored object path ("/objects/...") to a fully-qualified URL.
export function resolveStorageUrl(objectPath: string): string {
  if (/^https?:\/\//i.test(objectPath)) return objectPath;
  return `${BASE_URL}/api/storage${objectPath}`;
}

// Deletes rendered page images for a PDF book from storage (best-effort; logs on failure).
export async function deletePdfPages(bookId: string): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/pdf/pages/${encodeURIComponent(bookId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      console.warn(`deletePdfPages: server returned ${res.status} for bookId ${bookId}`);
    }
  } catch (e) {
    console.warn('deletePdfPages: network error', e);
  }
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
