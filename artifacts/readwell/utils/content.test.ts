import { describe, expect, it } from 'vitest';
import { getPdfQualityWarning, LOW_CONFIDENCE_WARNING_FRACTION } from './content';

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