import { describe, it, expect } from 'vitest';
import { inferOcrUsed, applyOcrMigration, parsePendingImports } from './AppContext';
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
// inferOcrUsed — real-world OCR pipeline fixtures
//
// The synthetic tests above validate the thresholds in isolation.  The
// fixtures below use text that is representative of actual output from the
// app's OCR pipeline (Google Vision / Tesseract) so we can confirm the
// thresholds work for real documents, not just clean synthetic strings.
// ---------------------------------------------------------------------------

describe('inferOcrUsed — real-world OCR pipeline fixtures', () => {
  // ── Native digital PDF ────────────────────────────────────────────────────
  // Text copied from a machine-readable academic PDF (no scanning involved).
  // Alpha ratio is near 1.0; average word length is 5–7 characters.
  // Expected: false (correctly identified as native-digital).

  it('returns false for a native-digital academic PDF (clean extraction, no OCR)', () => {
    const nativePdfPages = makePages([
      'Abstract: This paper presents a novel approach to distributed consensus in the presence of Byzantine faults.',
      'We introduce the concept of randomised agreement protocols, which guarantee termination with high probability.',
      'Our analysis shows that the proposed algorithm achieves optimal message complexity while maintaining safety.',
      'The protocol operates in asynchronous networks where processes may fail arbitrarily or send conflicting messages.',
      'Experimental results on a cluster of one hundred and twenty-eight nodes confirm that our approach scales well in practice.',
    ]);
    expect(inferOcrUsed(nativePdfPages)).toBe(false);
  });

  // ── High-quality scan — Google Vision ─────────────────────────────────────
  // A clearly-printed modern book scanned at 300 dpi and run through Google
  // Vision.  Cloud Vision on a clean scan produces near-perfect text, so the
  // output is visually indistinguishable from a native PDF.  The heuristic
  // correctly returns false here; this is an expected limitation — the badge
  // is most useful for identifying noticeably degraded scans, not pristine ones.

  it('returns false for high-quality Google Vision output from a well-scanned book (expected limitation: indistinguishable from native)', () => {
    const highQualityScanPages = makePages([
      'The emergence of digital technology has fundamentally transformed how societies organise information.',
      'Libraries that once occupied physical space in towns and cities have migrated to distributed server farms.',
      'The transition raises important questions about access, ownership, and the long-term preservation of knowledge.',
      'Scholars now expect instant retrieval of documents that previously required weeks of interlibrary loan requests.',
      'Whether this shift represents genuine democratisation of knowledge remains a contested question among researchers.',
    ]);
    // High-quality OCR produces alphabetic-ratio ~0.92 and avg word length ~5.5
    // — both comfortably above the thresholds, so the badge is not shown.
    expect(inferOcrUsed(highQualityScanPages)).toBe(false);
  });

  // ── Degraded scan — Tesseract spurious-space artifact ─────────────────────
  // Tesseract on a low-resolution or noisy scan commonly inserts extra spaces
  // in the middle of words (e.g. "re sult s" instead of "results").  This is
  // one of the most frequent real-world artifacts from photocopied documents
  // scanned at < 200 dpi or documents with speckled backgrounds.  The average
  // word-length drops well below 3.5, correctly triggering the OCR flag.

  it('returns true for Tesseract output from a degraded photocopy (spurious spaces fragment words)', () => {
    const degradedScanPages = makePages([
      'The re sult s sh ow ed th at tem per a ture in cre ased dur ing the fi rst phas e of the ex per i ment .',
      'Sam ple s w ere col lect ed at in ter val s of 5 m in utes ov er a per iod of 3 h ours .',
      'The av er age val ues w ere com put ed us ing the meth od de scribed in sect ion 2 and re cord ed bel ow .',
    ]);
    // Average word length ≈ 2.3 characters — below the 3.5 threshold.
    expect(inferOcrUsed(degradedScanPages)).toBe(true);
  });

  // ── Symbol-heavy scanned document — math textbook ─────────────────────────
  // A scanned scientific textbook with equations, Greek letters, and data
  // tables.  Google Vision outputs Unicode mathematical symbols (∑, ∫, π, ²,
  // ∞) which are non-alphabetic.  Numeric-heavy table rows add further
  // non-alpha content.  The alphabetic-character ratio falls well below 0.60,
  // correctly flagging the document as scanned/OCR-processed.

  it('returns true for Google Vision output from a scanned maths textbook (equations and tables dominate)', () => {
    const mathTextbookPages = makePages([
      // Inline equations — Greek letters and operators are non-alpha
      '∑_n=1^∞ 1/n² = π²/6.  ∫_0^∞ e^{−x²} dx = √π/2.  |z| < 1 ⟹ ∑_n z^n = 1/(1−z).',
      // Mixed prose + formula line
      'lim_{n→∞} (1 + 1/n)^n = e ≈ 2.71828.  det(A) = ∑_σ sgn(σ) ∏_i a_{i,σ(i)}.',
      // Data table — numbers and pipe characters dominate
      '| n | 1/n    | cumsum | error  | Δ      |\n| 1 | 1.000  | 1.000  | 0.6449 | —      |\n| 2 | 0.500  | 1.500  | 0.1449 | 0.500  |\n| 4 | 0.250  | 2.083  | 0.0616 | 0.583  |',
    ]);
    // Alphabetic-character ratio ≈ 0.15 — well below the 0.60 threshold.
    expect(inferOcrUsed(mathTextbookPages)).toBe(true);
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

// ---------------------------------------------------------------------------
// parsePendingImports — defensive parsing for AsyncStorage corruption
// ---------------------------------------------------------------------------

describe('parsePendingImports', () => {
  it('returns null for null input', () => {
    expect(parsePendingImports(null)).toBeNull();
  });

  it('returns an empty array for valid JSON with an empty array', () => {
    expect(parsePendingImports('[]')).toEqual([]);
  });

  it('returns parsed entries for valid JSON with valid entries', () => {
    const entries = [
      { serverBookId: 'book-a', registeredAt: '2026-01-01T00:00:00.000Z' },
      { serverBookId: 'book-b', registeredAt: '2026-01-02T00:00:00.000Z' },
    ];
    expect(parsePendingImports(JSON.stringify(entries))).toEqual(entries);
  });

  it('returns null for malformed JSON instead of throwing', () => {
    expect(parsePendingImports('{not valid json')).toBeNull();
  });

  it('returns null when the stored value is not an array', () => {
    expect(parsePendingImports('{"serverBookId":"book-a"}')).toBeNull();
  });

  it('filters out entries that are missing required fields', () => {
    const mixed = [
      { serverBookId: 'valid-book', registeredAt: '2026-01-01T00:00:00.000Z' },
      { serverBookId: 'missing-registeredAt' },
      { registeredAt: 'missing-serverBookId' },
      'not-an-object',
      null,
    ];
    const result = parsePendingImports(JSON.stringify(mixed));
    expect(result).toEqual([{ serverBookId: 'valid-book', registeredAt: '2026-01-01T00:00:00.000Z' }]);
  });
});
