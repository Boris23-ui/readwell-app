import { describe, expect, it } from 'vitest';
import {
  getPdfQualityWarning,
  LOW_CONFIDENCE_WARNING_FRACTION,
  isTextQualityTooLow,
  splitIntoParagraphs,
  createStarterBook,
  STARTER_BOOK_ID,
} from './content';

describe('getPdfQualityWarning', () => {
  it('does not warn when low-confidence pages stay below the threshold', () => {
    expect(
      getPdfQualityWarning([
        { lowConfidence: true },
        { lowConfidence: false },
        { lowConfidence: false },
        { lowConfidence: false },
      ]),
    ).toBeNull();
  });

  it('warns when low-confidence pages exceed the configured threshold', () => {
    expect(LOW_CONFIDENCE_WARNING_FRACTION).toBe(0.3);
    expect(
      getPdfQualityWarning([
        { lowConfidence: true },
        { lowConfidence: true },
        { lowConfidence: false },
        { lowConfidence: false },
      ]),
    ).toEqual({ lowConfidencePageCount: 2, pageCount: 4 });
  });

  it('does not warn when low-confidence pages are exactly at the threshold', () => {
    const pages = [
      ...Array.from({ length: 3 }, () => ({ lowConfidence: true })),
      ...Array.from({ length: 7 }, () => ({ lowConfidence: false })),
    ];

    expect(getPdfQualityWarning(pages)).toBeNull();
  });
});

describe('isTextQualityTooLow', () => {
  it('returns true for empty or whitespace text', () => {
    expect(isTextQualityTooLow('')).toBe(true);
    expect(isTextQualityTooLow('   \n\t  ')).toBe(true);
  });

  it('returns true when word count is below 30', () => {
    const shortText = 'This is a short paragraph with only a few words in it, nowhere near thirty words.';
    expect(isTextQualityTooLow(shortText)).toBe(true);
  });

  it('returns true when text is full of symbols and low alphabetic ratio', () => {
    const noisy = Array.from({ length: 35 }, (_, i) => `w!@#$%^&*()_${i}`).join(' ');
    expect(isTextQualityTooLow(noisy)).toBe(true);
  });

  it('returns true when words lack vowels (OCR noise from blurry scans)', () => {
    const vowelLess = Array.from({ length: 35 }, () => 'bcdf ghjk lmnp').join(' ');
    expect(isTextQualityTooLow(vowelLess)).toBe(true);
  });

  it('returns true on repetitive hallucination loops', () => {
    const loop = Array.from({ length: 35 }, () => 'loop').join(' ');
    expect(isTextQualityTooLow(loop)).toBe(true);
  });

  it('returns false for readable natural reading text with sufficient words', () => {
    const readable =
      'The ancient library stood quiet in the golden evening light. Shelves of weathered leather books ' +
      'stretched from floor to ceiling, filled with forgotten histories and timeless philosophy. ' +
      'Every chapter offered a new discovery for curious minds willing to pause and reflect on the lessons of the past.';
    expect(isTextQualityTooLow(readable)).toBe(false);
  });
});

describe('splitIntoParagraphs', () => {
  it('splits standard blank-line separated paragraphs', () => {
    const text =
      'First paragraph has plenty of words to pass the minimum length threshold easily.\n\n' +
      'Second paragraph also contains enough words to be treated as its own reading unit.';
    const result = splitIntoParagraphs(text);
    expect(result).toHaveLength(2);
  });

  it('falls back to single-newline splitting when blank lines are missing', () => {
    const text =
      'First line comes from a copied article with single newlines and enough words.\n' +
      'Second line continues the article with another complete paragraph worth of words.\n' +
      'Third line wraps up the short passage with plenty of words included.';
    const result = splitIntoParagraphs(text);
    expect(result).toHaveLength(3);
  });

  it('splits a long single-block wall of text at sentence boundaries', () => {
    const text =
      'Attention is a finite resource that modern feeds compete for aggressively every single day. ' +
      'When readers open a book after scrolling, the slower pace can initially feel unfamiliar and quiet. ' +
      'Breaking chapters into five-paragraph checkpoints shortens the reward loop without cheapening the text. ' +
      'Active recall strengthens memory far better than passive highlighting or skimming alone. ' +
      'Consistent daily sessions compound into dozens of finished books over the course of a year.';
    const result = splitIntoParagraphs(text);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns fewer than 2 paragraphs for very short text', () => {
    expect(splitIntoParagraphs('Too short.')).toHaveLength(0);
  });
});

describe('createStarterBook', () => {
  it('creates a valid ready-to-read text book with quiz-eligible segments', () => {
    const book = createStarterBook();
    expect(book.id).toBe(STARTER_BOOK_ID);
    expect(book.sourceType).toBe('text');
    expect(book.segments.length).toBeGreaterThanOrEqual(2);
    for (const segment of book.segments) {
      expect(isTextQualityTooLow(segment.paragraphs.join('\n\n'))).toBe(false);
    }
  });
});