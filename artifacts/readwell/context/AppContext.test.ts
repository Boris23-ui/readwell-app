import { describe, it, expect } from 'vitest';
import { inferOcrUsed, applyOcrMigration } from './AppContext';
import type { Book, PdfPage } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePages(texts: string[]): PdfPage[] {
  return texts.map((text, i) => ({
    pageNumber: i + 1,
    imageUrl: `/objects/pdf-pages/book-x/page-${i + 1}.jpg`,
    width: 800,
    height: 1200,
    text,
  }));
}

function makePdfBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'Test Book',
    author: 'Author',
    content: '',
    segments: [],
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    wordCount: 0,
    currentSegmentIndex: 0,
    coverColor: '#AABBCC',
    sourceType: 'pdf',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// inferOcrUsed — unit tests
// ---------------------------------------------------------------------------

describe('inferOcrUsed', () => {
  // ── Clean native PDF text ─────────────────────────────────────────────────

  it('returns false for clean native PDF text (high alpha ratio, normal word length)', () => {
    const pages = makePages([
      'The quick brown fox jumps over the lazy dog.',
      'Chapter one begins with a long and well-formed sentence about the world.',
      'Native PDF text extracted cleanly has proper words and punctuation throughout.',
    ]);
    expect(inferOcrUsed(pages)).toBe(false);
  });

  it('returns false when alphabetic ratio is above 0.60 and avg word length is above 3.5', () => {
    // Pure prose — 100 % alpha characters (no digits/symbols), long words
    const pages = makePages([
      'Reading comprehension requires sustained attention and vocabulary knowledge.',
    ]);
    expect(inferOcrUsed(pages)).toBe(false);
  });

  // ── OCR-heavy / noisy text ────────────────────────────────────────────────

  it('returns true for OCR noise with a low alphabetic-character ratio (lots of symbols)', () => {
    // Inject enough non-alpha noise to drop the ratio below 0.60
    // e.g. "|", "}", "#", "~", "^", digits scattered through the text
    const noisyText =
      '||| ## ~~ ^^ 1234 5678 }}} ||| ## ~~ a b c d e ||| ## 9999 ~~ ^^';
    const pages = makePages([noisyText, noisyText, noisyText]);
    expect(inferOcrUsed(pages)).toBe(true);
  });

  it('returns true for OCR output with very short average word length (garbled tokens)', () => {
    // Garbled OCR tokens: single characters and two-character fragments
    const garbled = 'a b c d e f g h i j k l m n o p q r s t u v w x y z a b';
    const pages = makePages([garbled, garbled, garbled]);
    expect(inferOcrUsed(pages)).toBe(true);
  });

  it('returns true when both conditions are met simultaneously (noisy + garbled)', () => {
    const pages = makePages([
      '| 1 } ~ a 2 b # c 3 d | e 4 | 5 f | g ~ 6 h',
    ]);
    expect(inferOcrUsed(pages)).toBe(true);
  });

  // ── Empty / missing text ──────────────────────────────────────────────────

  it('returns undefined for an empty pages array', () => {
    expect(inferOcrUsed([])).toBeUndefined();
  });

  it('returns undefined when all pages have empty text strings', () => {
    const pages = makePages(['', '', '']);
    expect(inferOcrUsed(pages)).toBeUndefined();
  });

  it('returns undefined when all pages have whitespace-only text', () => {
    const pages = makePages(['   ', '\t\n', '  ']);
    expect(inferOcrUsed(pages)).toBeUndefined();
  });

  it('returns undefined when pages lack a text field (undefined text treated as empty)', () => {
    // Simulate old book objects where text was not stored
    const pages = [{ pageNumber: 1, imageUrl: '/img', width: 800, height: 1200, text: undefined as unknown as string }];
    expect(inferOcrUsed(pages)).toBeUndefined();
  });

  // ── Sampling behaviour (more than 10 pages) ───────────────────────────────

  it('only samples the first 10 pages even when more are provided', () => {
    // Pages 1-10: clean native text → false
    // Pages 11+: pure OCR noise → would flip to true if sampled
    const cleanText = 'The quick brown fox jumps over the lazy dog in the forest.';
    const noiseText = '| 1 } ~ | 2 } ~ | 3 } ~ | 4 } ~ | 5';
    const pages = makePages([
      ...Array(10).fill(cleanText),
      ...Array(5).fill(noiseText),
    ]);
    // Because only the first 10 pages (all clean) are sampled, result is false
    expect(inferOcrUsed(pages)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyOcrMigration — unit tests
// ---------------------------------------------------------------------------

describe('applyOcrMigration', () => {
  it('sets ocrUsed to false on a PDF book with clean text that has no ocrUsed field yet', () => {
    const cleanText = 'The quick brown fox jumps over the lazy dog in the garden.';
    const book = makePdfBook({ pages: makePages([cleanText]) });
    expect(book.ocrUsed).toBeUndefined();

    const { books, dirty } = applyOcrMigration([book]);

    expect(dirty).toBe(true);
    expect(books[0].ocrUsed).toBe(false);
  });

  it('sets ocrUsed to true on a PDF book with noisy OCR text that has no ocrUsed field yet', () => {
    const noisyText = 'a b c d e f g h i j k l m n o p q r s t u v w x y z a b';
    const book = makePdfBook({ pages: makePages([noisyText]) });

    const { books, dirty } = applyOcrMigration([book]);

    expect(dirty).toBe(true);
    expect(books[0].ocrUsed).toBe(true);
  });

  it('does not mutate a PDF book that already has ocrUsed set to false', () => {
    const book = makePdfBook({
      pages: makePages(['some text']),
      ocrUsed: false,
    });

    const { books, dirty } = applyOcrMigration([book]);

    expect(dirty).toBe(false);
    expect(books[0].ocrUsed).toBe(false);
    expect(books[0]).toBe(book); // same reference — not cloned
  });

  it('does not mutate a PDF book that already has ocrUsed set to true', () => {
    const book = makePdfBook({
      pages: makePages(['some text']),
      ocrUsed: true,
    });

    const { books, dirty } = applyOcrMigration([book]);

    expect(dirty).toBe(false);
    expect(books[0].ocrUsed).toBe(true);
  });

  it('skips non-PDF books (sourceType !== pdf)', () => {
    const book: Book = {
      ...makePdfBook(),
      sourceType: 'text',
      pages: makePages(['a b c d e f']),
    };

    const { books, dirty } = applyOcrMigration([book]);

    expect(dirty).toBe(false);
    expect(books[0].ocrUsed).toBeUndefined();
  });

  it('skips PDF books that have no pages', () => {
    const book = makePdfBook({ pages: [] });

    const { books, dirty } = applyOcrMigration([book]);

    expect(dirty).toBe(false);
    expect(books[0].ocrUsed).toBeUndefined();
  });

  it('skips PDF books whose pages all have empty text (inferOcrUsed returns undefined)', () => {
    const book = makePdfBook({ pages: makePages(['', '']) });

    const { books, dirty } = applyOcrMigration([book]);

    expect(dirty).toBe(false);
    // ocrUsed stays undefined — cannot infer from blank text
    expect(books[0].ocrUsed).toBeUndefined();
  });

  it('returns dirty=false and an empty list for an empty input', () => {
    const { books, dirty } = applyOcrMigration([]);

    expect(dirty).toBe(false);
    expect(books).toHaveLength(0);
  });

  it('only updates the books that need migration in a mixed list', () => {
    const cleanText = 'The quick brown fox jumps over the lazy dog in the valley.';
    const noisyText = 'a b c d e f g h i j k l m n o p q r s t';

    const alreadyMigrated = makePdfBook({ id: 'a', pages: makePages([cleanText]), ocrUsed: false });
    const needsMigrationClean = makePdfBook({ id: 'b', pages: makePages([cleanText]) });
    const needsMigrationNoisy = makePdfBook({ id: 'c', pages: makePages([noisyText]) });
    const textBook: Book = { ...makePdfBook({ id: 'd' }), sourceType: 'text', pages: undefined };

    const { books, dirty } = applyOcrMigration([
      alreadyMigrated,
      needsMigrationClean,
      needsMigrationNoisy,
      textBook,
    ]);

    expect(dirty).toBe(true);
    expect(books[0].ocrUsed).toBe(false); // unchanged
    expect(books[1].ocrUsed).toBe(false); // inferred clean
    expect(books[2].ocrUsed).toBe(true);  // inferred noisy
    expect(books[3].ocrUsed).toBeUndefined(); // text book untouched
  });

  it('persisting intent: the returned book list is the one that should be stored', () => {
    // The migration should produce a new book object (spread), not mutate in place
    const cleanText = 'This sentence is clean and readable English text for testing.';
    const book = makePdfBook({ pages: makePages([cleanText]) });
    const original = book;

    const { books } = applyOcrMigration([book]);

    // Original object must NOT be mutated
    expect(original.ocrUsed).toBeUndefined();
    // Returned object must be a new reference with the field set
    expect(books[0]).not.toBe(original);
    expect(books[0].ocrUsed).toBe(false);
  });
});
