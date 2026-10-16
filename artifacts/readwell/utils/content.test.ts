import { describe, expect, it } from 'vitest';
import { getPdfQualityWarning, LOW_CONFIDENCE_WARNING_FRACTION, isTextQualityTooLow } from './content';

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