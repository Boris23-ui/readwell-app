import { describe, expect, it } from 'vitest';
import { getPdfQualityWarning } from './content';

describe('getPdfQualityWarning', () => {
  it('does not warn for a single low-confidence page', () => {
    expect(
      getPdfQualityWarning([
        { lowConfidence: true },
        { lowConfidence: false },
        { lowConfidence: false },
      ]),
    ).toBeNull();
  });

  it('warns when at least two pages make up a substantial share of the PDF', () => {
    expect(
      getPdfQualityWarning([
        { lowConfidence: true },
        { lowConfidence: true },
        { lowConfidence: false },
        { lowConfidence: false },
      ]),
    ).toEqual({ lowConfidencePageCount: 2, pageCount: 4 });
  });

  it('also warns for several low-confidence pages in a longer PDF', () => {
    const pages = [
      ...Array.from({ length: 3 }, () => ({ lowConfidence: true })),
      ...Array.from({ length: 7 }, () => ({ lowConfidence: false })),
    ];

    expect(getPdfQualityWarning(pages)).toEqual({
      lowConfidencePageCount: 3,
      pageCount: 10,
    });
  });
});