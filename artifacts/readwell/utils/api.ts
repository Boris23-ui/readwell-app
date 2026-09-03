export type UploadFile = File | { uri: string; name: string; type: string };

function appendFile(formData: FormData, fieldName: string, file: UploadFile) {
  if ('uri' in file) {
    // React Native file upload: FormData expects { uri, name, type }
    formData.append(fieldName, file as any);
  } else {
    formData.append(fieldName, file);
  }
}

export interface UploadProgress {
  phase: 'uploading' | 'processing';
  fraction: number;
}

export interface MultipartRequestOptions {
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  language?: string;
}

function createAbortError(): Error {
  const error = new Error('Import cancelled.');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function requestMultipartJson<T>(
  url: string,
  file: UploadFile,
  options: MultipartRequestOptions = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      callback();
    };

    const abort = () => {
      if (settled) return;
      xhr.abort();
      finish(() => reject(createAbortError()));
    };

    if (options.signal?.aborted) {
      reject(createAbortError());
      return;
    }

    appendFile(formData, 'file', file);
    if (options.language) {
      formData.append('language', options.language);
    }
    xhr.open('POST', url);
    xhr.timeout = 5 * 60 * 1000;
    xhr.responseType = 'text';
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options.onProgress?.({
        phase: 'uploading',
        fraction: Math.min(1, event.loaded / event.total),
      });
    };
    xhr.upload.onload = () => {
      options.onProgress?.({ phase: 'processing', fraction: 1 });
    };
    xhr.onload = () => {
      const parsed = (() => {
        try {
          const value = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          return value && typeof value === 'object' ? value : {};
        } catch {
          return {};
        }
      })();

      if (xhr.status >= 200 && xhr.status < 300) {
        finish(() => resolve(parsed as T));
        return;
      }

      const error = new Error(parsed.error ?? `Request failed with status ${xhr.status}`) as Error & {
        code?: string;
      };
      error.code = parsed.code;
      finish(() => reject(error));
    };
    xhr.onerror = () => finish(() => reject(new Error('Network error while uploading the file.')));
    xhr.ontimeout = () => finish(() => reject(new Error('The file upload timed out.')));
    xhr.onabort = () => finish(() => reject(createAbortError()));
    options.signal?.addEventListener('abort', abort, { once: true });

    try {
      xhr.send(formData);
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      (window.location.port === '8081' || window.location.port === '19006' || window.location.port === '8082')
    ) {
      return 'http://localhost:3000';
    }
    return window.location.origin;
  }
  throw new Error(
    'EXPO_PUBLIC_DOMAIN is not set. The app cannot reach the ReadWell server. ' +
      'Make sure the dev script includes EXPO_PUBLIC_DOMAIN=$REPLIT_EXPO_DEV_DOMAIN.',
  );
}

export async function extractTextFromFile(
  file: UploadFile,
  options: MultipartRequestOptions = {},
): Promise<{ text: string; suggestedTitle: string }> {
  return requestMultipartJson(`${getBaseUrl()}/api/extract-text`, file, options);
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

export async function renderPdf(
  file: UploadFile,
  options: MultipartRequestOptions = {},
): Promise<RenderPdfResult> {
  return requestMultipartJson(`${getBaseUrl()}/api/render-pdf`, file, options);
}

// Resolves a stored object path ("/objects/...") to a fully-qualified URL.
export function resolveStorageUrl(objectPath: string): string {
  if (/^https?:\/\//i.test(objectPath)) return objectPath;
  return `${getBaseUrl()}/api/storage${objectPath}`;
}

/**
 * Delete all rendered page images for a PDF book from storage.
 *
 * Throws on network errors or non-2xx responses so that callers that manage a
 * persistent retry queue can detect failure.  Callers that want fire-and-forget
 * behaviour should catch the rejection themselves.
 */
export async function deletePdfPages(bookId: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/pdf/pages/${encodeURIComponent(bookId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`deletePdfPages: server returned ${res.status} for bookId ${bookId}`);
  }
}

export async function generateQuiz(
  segmentText: string,
  readingLevel: string,
  elo?: number,
  secondsRead?: number,
  wordCount?: number,
  complexity?: number
): Promise<{ questions: any[] }> {
  const response = await fetch(`${getBaseUrl()}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segmentText, readingLevel, elo, secondsRead, wordCount, complexity }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error((err as any).error ?? 'Failed to generate quiz') as Error & { code?: string };
    error.code = (err as any).code;
    throw error;
  }
  return response.json();
}

export async function simplifyText(
  segmentText: string,
  targetLevel: string,
): Promise<{ text: string }> {
  const response = await fetch(`${getBaseUrl()}/api/simplify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segmentText, targetLevel }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error((err as any).error ?? 'Failed to simplify text') as Error & { code?: string };
    error.code = (err as any).code;
    throw error;
  }
  return response.json();
}

export interface RecommendationRequest {
  elo?: number;
  readingLevel?: string;
  interests?: string[];
  recentTopics?: string[];
}

export async function fetchRecommendations(params: RecommendationRequest) {
  const response = await fetch(`${getBaseUrl()}/api/recommendations/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error((err as any).error ?? 'Failed to fetch recommendations') as Error & { code?: string };
    error.code = (err as any).code;
    throw error;
  }
  return response.json();
}

// ── ReadWell Coach Agent Client API ──────────────────────────────────────────

export interface CoachChatPayload {
  userId: string;
  message: string;
  bookContext?: {
    bookId?: string;
    title?: string;
    author?: string;
    chapter?: number;
    segmentText?: string;
  };
}

export interface CoachChatResult {
  reply: string;
  strategyVersion: number;
  agentName: string;
  intent: string;
  detectedSignal?: string;
  evolved?: boolean;
}

export async function chatWithCoach(payload: CoachChatPayload): Promise<CoachChatResult> {
  const response = await fetch(`${getBaseUrl()}/api/coach/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error((err as any).error ?? 'Failed to reach ReadWell Coach') as Error & { code?: string };
    error.code = (err as any).code;
    throw error;
  }
  return response.json();
}

export async function fetchCoachProfile(userId: string) {
  const response = await fetch(`${getBaseUrl()}/api/coach/profile/${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch coach profile');
  return response.json();
}

export async function updateCoachProfile(userId: string, updates: any) {
  const response = await fetch(`${getBaseUrl()}/api/coach/profile/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update coach profile');
  return response.json();
}

export async function fetchCoachStrategy(userId: string) {
  const response = await fetch(`${getBaseUrl()}/api/coach/strategy/${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch coach strategy');
  return response.json();
}

export async function fetchCoachEvolution(userId: string) {
  const response = await fetch(`${getBaseUrl()}/api/coach/evolution/${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch evolution history');
  return response.json();
}

export async function triggerCoachEvolution(userId: string, reason?: string) {
  const response = await fetch(`${getBaseUrl()}/api/coach/trigger-evolution/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error('Failed to trigger coach evolution');
  return response.json();
}

export async function fetchCoachDigest(userId: string) {
  const response = await fetch(`${getBaseUrl()}/api/coach/digest/${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch coach digest');
  return response.json();
}

export async function fetchCoachFlashcards(userId: string) {
  const response = await fetch(`${getBaseUrl()}/api/coach/flashcards/${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch flashcards');
  return response.json();
}

export async function createCoachFlashcard(userId: string, card: any) {
  const response = await fetch(`${getBaseUrl()}/api/coach/flashcards/${encodeURIComponent(userId)}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });
  if (!response.ok) throw new Error('Failed to create flashcard');
  return response.json();
}

export async function reviewCoachFlashcard(userId: string, cardId: string, quality: number, cardFront?: string) {
  const response = await fetch(`${getBaseUrl()}/api/coach/flashcards/${encodeURIComponent(userId)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, quality, cardFront }),
  });
  if (!response.ok) throw new Error('Failed to review flashcard');
  return response.json();
}

export async function calculateCoachReadingPlan(totalUnits: number, availableMinutes: number, targetDays: number) {
  const response = await fetch(`${getBaseUrl()}/api/coach/plan/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalUnits, availableMinutes, targetDays }),
  });
  if (!response.ok) throw new Error('Failed to calculate reading plan');
  return response.json();
}

export async function createCoachReadingPlan(payload: {
  userId: string;
  bookTitle: string;
  totalChapters: number;
  targetDays: number;
  availableMinutes?: number;
}) {
  const response = await fetch(`${getBaseUrl()}/api/coach/plan/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to create reading plan');
  return response.json();
}

export async function searchCoachBooks(query: string, maxResults = 5) {
  const response = await fetch(`${getBaseUrl()}/api/coach/books/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
  if (!response.ok) throw new Error('Failed to search books');
  return response.json();
}

