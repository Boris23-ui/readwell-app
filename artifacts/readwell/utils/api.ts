export type UploadFile = File | { uri: string; name: string; type: string };

function appendFile(formData: FormData, fieldName: string, file: UploadFile) {
  if ('uri' in file) {
    // React Native file upload: FormData expects { uri, name, type }
    formData.append(fieldName, file as any);
  } else {
    formData.append(fieldName, file);
  }
}

const BASE_URL = (() => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  throw new Error(
    'EXPO_PUBLIC_DOMAIN is not set. The app cannot reach the ReadWell server. ' +
      'Make sure the dev script includes EXPO_PUBLIC_DOMAIN=$REPLIT_EXPO_DEV_DOMAIN.',
  );
})();

export async function extractTextFromFile(
  file: UploadFile,
): Promise<{ text: string; suggestedTitle: string }> {
  const formData = new FormData();
  appendFile(formData, 'file', file);

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
  /** True when the page had too few recoverable words for reliable quiz generation. */
  lowConfidence?: boolean;
}

export interface RenderPdfResult {
  bookId: string;
  suggestedTitle: string;
  pageCount: number;
  pages: RenderedPdfPage[];
  ocrUsed?: boolean;
  /** ISO timestamp after which the server may clean up orphaned page images. */
  expiresAt?: string;
}

export async function renderPdf(file: UploadFile): Promise<RenderPdfResult> {
  const formData = new FormData();
  appendFile(formData, 'file', file);

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

/**
 * Delete all rendered page images for a PDF book from storage.
 *
 * Throws on network errors or non-2xx responses so that callers that manage a
 * persistent retry queue can detect failure.  Callers that want fire-and-forget
 * behaviour should catch the rejection themselves.
 */
export async function deletePdfPages(bookId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/pdf/pages/${encodeURIComponent(bookId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`deletePdfPages: server returned ${res.status} for bookId ${bookId}`);
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
    const error = new Error((err as any).error ?? 'Failed to generate quiz') as Error & { code?: string };
    error.code = (err as any).code;
    throw error;
  }
  return response.json();
}
