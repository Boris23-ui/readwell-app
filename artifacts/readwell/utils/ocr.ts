import { Book } from '@/types';
import { PendingPdfImport } from '../context/orphanCleanup';

/**
 * Heuristic: estimate whether a PDF book was processed via OCR.
 */
export function inferOcrUsed(pages: { text: string }[]): boolean | undefined {
  const sample = pages.slice(0, 10);
  const combined = sample.map(p => p.text ?? '').join(' ').trim();
  if (!combined) return undefined;

  const nonWs = combined.replace(/\s/g, '');
  if (!nonWs.length) return undefined;
  const alphaCount = (nonWs.match(/[a-zA-Z]/g) ?? []).length;
  const alphaRatio = alphaCount / nonWs.length;

  const words = combined.split(/\s+/).filter(w => w.length > 0);
  const avgWordLen = words.length ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;

  return alphaRatio < 0.60 || avgWordLen < 3.5;
}

/**
 * Apply the OCR backfill migration to a list of books.
 */
export function applyOcrMigration(books: Book[]): { books: Book[]; dirty: boolean } {
  let dirty = false;
  const updated = books.map(book => {
    if (book.sourceType === 'pdf' && book.ocrUsed === undefined && book.pages?.length) {
      const inferred = inferOcrUsed(book.pages);
      dirty = true;
      return { ...book, ocrUsed: inferred ?? null };
    }
    return book;
  });
  return { books: updated, dirty };
}

/**
 * Safely parse the raw PENDING_PDF_IMPORTS value from AsyncStorage.
 */
export function parsePendingImports(raw: string | null): PendingPdfImport[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is PendingPdfImport =>
          item && typeof item.serverBookId === 'string' && typeof item.registeredAt === 'string',
      );
    }
  } catch (e) {
    console.warn('parsePendingImports: stored value is malformed, skipping orphan cleanup', e);
  }
  return null;
}
