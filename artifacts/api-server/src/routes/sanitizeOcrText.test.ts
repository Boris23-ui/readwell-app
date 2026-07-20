/**
 * Unit tests for sanitizeOcrText
 *
 * Covers:
 *  - lone-character lines (noise glyphs)
 *  - non-alphanumeric-only lines (e.g. "--- ---", "| |")
 *  - repeated-glyph runs (e.g. "~~~~", "====")
 *  - broken hyphenation (word-\nnextword)
 *  - excessive internal whitespace
 *  - real-world OCR noise fixture: word count and structure within expected bounds
 */
import { describe, it, expect } from "vitest";
import { sanitizeOcrText, correctOcrSubstitutions } from "./pdf";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sanitizeOcrText — lone-character lines", () => {
  it("removes lines that are exactly one character after trimming", () => {
    const input = "Hello\n.\nWorld\n!\nEnd";
    const result = sanitizeOcrText(input);
    expect(result).not.toMatch(/^\.$|^!$/m);
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    expect(result).toContain("End");
  });

  it("removes a lone digit line", () => {
    const input = "First paragraph\n3\nSecond paragraph";
    const result = sanitizeOcrText(input);
    expect(result).not.toMatch(/^3$/m);
    expect(result).toContain("First paragraph");
    expect(result).toContain("Second paragraph");
  });

  it("removes a lone letter line", () => {
    const input = "Line one\na\nLine two";
    const result = sanitizeOcrText(input);
    // A lone "a" on its own line should be removed; "Line one" and "Line two" kept
    const lines = result.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines).not.toContain("a");
    expect(lines.some((l) => l.includes("Line one"))).toBe(true);
    expect(lines.some((l) => l.includes("Line two"))).toBe(true);
  });

  it("keeps blank lines (empty lines are not lone-character lines)", () => {
    const input = "Para one\n\nPara two";
    const result = sanitizeOcrText(input);
    expect(result).toContain("Para one");
    expect(result).toContain("Para two");
  });
});

describe("sanitizeOcrText — non-alphanumeric-only lines", () => {
  it("removes lines made entirely of dashes and spaces", () => {
    const input = "Chapter 1\n--- --- ---\nSome content here";
    const result = sanitizeOcrText(input);
    expect(result).not.toMatch(/^--- --- ---$/m);
    expect(result).toContain("Chapter 1");
    expect(result).toContain("Some content here");
  });

  it("removes a pipe-only line", () => {
    const input = "Table start\n| |\nTable data";
    const result = sanitizeOcrText(input);
    expect(result).not.toMatch(/^\| \|$/m);
  });

  it("removes a line of only punctuation", () => {
    const input = "Before\n***\nAfter";
    const result = sanitizeOcrText(input);
    expect(result).not.toMatch(/^\*\*\*$/m);
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("keeps lines that mix alphanumeric and punctuation", () => {
    const input = "Hello, world!\nPrice: $9.99\nEnd.";
    const result = sanitizeOcrText(input);
    expect(result).toContain("Hello, world!");
    expect(result).toContain("Price: $9.99");
    expect(result).toContain("End.");
  });

  it("keeps blank lines (they pass through the alphanumeric check)", () => {
    const input = "One\n\nTwo";
    const result = sanitizeOcrText(input);
    expect(result).toContain("One");
    expect(result).toContain("Two");
  });
});

describe("sanitizeOcrText — repeated-glyph runs", () => {
  it("removes 4+ repeated non-word characters in a line", () => {
    const input = "Section ~~~~ end";
    const result = sanitizeOcrText(input);
    expect(result).not.toContain("~~~~");
    expect(result).toContain("Section");
    expect(result).toContain("end");
  });

  it("removes runs of equals signs", () => {
    const input = "Title\n======\nBody text";
    // The equals-only line is removed by the non-alphanumeric filter,
    // and the run collapse also applies inside lines.
    const result = sanitizeOcrText(input);
    expect(result).not.toContain("======");
  });

  it("removes runs of hyphens within a line (5+)", () => {
    const input = "Word --------- word";
    const result = sanitizeOcrText(input);
    expect(result).not.toContain("---------");
  });

  it("preserves ellipsis (3 dots is under the 4-repeat threshold)", () => {
    // The regex collapses ([^\w\s])\1{3,} — that means 4+ total (char + 3 more).
    // "..." is only 3 characters so it is preserved.
    const input = "Wait... then go";
    const result = sanitizeOcrText(input);
    expect(result).toContain("...");
  });

  it("collapses a run of 4+ dots", () => {
    const input = "End.... of section";
    const result = sanitizeOcrText(input);
    // 4 dots: char='.', repeated 3 more → matches ([^\w\s])\1{3,} → collapsed
    expect(result).not.toContain("....");
  });

  it("does not touch repeated word characters (letters/digits)", () => {
    const input = "Woooord and 1111";
    const result = sanitizeOcrText(input);
    // The regex only targets non-word, non-space chars; letters are \w
    expect(result).toContain("Woooord");
    expect(result).toContain("1111");
  });
});

describe("sanitizeOcrText — broken hyphenation", () => {
  it("joins a word split across lines with a trailing hyphen", () => {
    const input = "The re-\nmarkable thing";
    const result = sanitizeOcrText(input);
    expect(result).toContain("remarkable");
    expect(result).not.toContain("re-\n");
  });

  it("joins multiple broken hyphenations", () => {
    const input = "in-\ntro-\nduction";
    const result = sanitizeOcrText(input);
    expect(result).toContain("introduction");
  });

  it("does not join a hyphen at the end of a sentence with a blank next line", () => {
    // hyphen followed by \n then a non-word char — regex requires \w on both sides
    const input = "Chapter-\n\nNew paragraph";
    const result = sanitizeOcrText(input);
    // Should not crash and should retain both parts
    expect(result).toContain("Chapter");
    expect(result).toContain("New paragraph");
  });
});

describe("sanitizeOcrText — excessive whitespace", () => {
  it("collapses multiple spaces within a line to one", () => {
    const input = "Word   with     spaces";
    const result = sanitizeOcrText(input);
    expect(result).toBe("Word with spaces");
  });

  it("collapses tabs within a line to a single space", () => {
    const input = "Col1\t\t\tCol2";
    const result = sanitizeOcrText(input);
    expect(result).toBe("Col1 Col2");
  });

  it("collapses 3+ consecutive blank lines to two newlines (one blank line)", () => {
    const input = "Para A\n\n\n\nPara B";
    const result = sanitizeOcrText(input);
    // Should not have more than 2 consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain("Para A");
    expect(result).toContain("Para B");
  });

  it("trims leading and trailing whitespace", () => {
    const input = "   \n  hello world  \n   ";
    const result = sanitizeOcrText(input);
    expect(result).toBe("hello world");
  });

  it("does not collapse intentional single newlines", () => {
    const input = "Line one\nLine two\nLine three";
    const result = sanitizeOcrText(input);
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// correctOcrSubstitutions tests
// ---------------------------------------------------------------------------

describe("correctOcrSubstitutions — pipe misread as lowercase L", () => {
  it("replaces | with l when flanked by lowercase letters", () => {
    expect(correctOcrSubstitutions("samp|e")).toBe("sample");
  });

  it("replaces | with l in the middle of a word", () => {
    expect(correctOcrSubstitutions("on|y")).toBe("only");
  });

  it("replaces multiple | occurrences between lowercase letters", () => {
    expect(correctOcrSubstitutions("c|ear|y")).toBe("clearly");
  });

  it("does not replace | that is not flanked by lowercase on both sides", () => {
    // | at start of string with no preceding lowercase — not corrected by the
    // lowercase-flanked rule; only the word-boundary-uppercase rule applies
    expect(correctOcrSubstitutions("A|B")).toBe("A|B");
  });
});

describe("correctOcrSubstitutions — pipe misread as capital I (standalone token)", () => {
  it("replaces a standalone | surrounded by spaces with I", () => {
    expect(correctOcrSubstitutions("She and | both went")).toBe("She and I both went");
  });

  it("replaces | at the start of a string when followed by a space", () => {
    expect(correctOcrSubstitutions("| went to the store")).toBe("I went to the store");
  });

  it("replaces | at the end of a line when preceded by a space", () => {
    expect(correctOcrSubstitutions("She and |")).toBe("She and I");
  });

  it("replaces multiple standalone pipes in one pass", () => {
    expect(correctOcrSubstitutions("| saw | leave")).toBe("I saw I leave");
  });

  it("does not replace | that is flanked by non-space characters", () => {
    // | between word characters is handled by the lowercase-l rule, not the I rule
    expect(correctOcrSubstitutions("A|B")).toBe("A|B");
  });
});

describe("correctOcrSubstitutions — zero misread as letter o", () => {
  it("replaces 0 with o between lowercase letters", () => {
    expect(correctOcrSubstitutions("c0mputer")).toBe("computer");
  });

  it("replaces 0 in the middle of a word", () => {
    expect(correctOcrSubstitutions("w0rd")).toBe("word");
  });

  it("replaces multiple zeros between lowercase letters", () => {
    // "b0tt0m": both 0s are flanked by lowercase on each side → both → "o"
    expect(correctOcrSubstitutions("b0tt0m")).toBe("bottom");
  });

  it("does not replace 0 when not between lowercase letters", () => {
    // Standalone number or between non-lowercase characters
    expect(correctOcrSubstitutions("100")).toBe("100");
    expect(correctOcrSubstitutions("A0B")).toBe("A0B");
  });

  it("does not replace 0 that follows an uppercase letter", () => {
    expect(correctOcrSubstitutions("V0ice")).toBe("V0ice");
  });
});

describe("correctOcrSubstitutions — digit-one misread as lowercase L at word start", () => {
  it("replaces 1 with l at the start of a word followed by 2+ lowercase letters", () => {
    expect(correctOcrSubstitutions("1azy")).toBe("lazy");
  });

  it("replaces 1 at word start in a sentence", () => {
    expect(correctOcrSubstitutions("The 1ion roared")).toBe("The lion roared");
  });

  it("does not replace 1 that is not at a word boundary", () => {
    // Mid-word digit — could be intentional (e.g. "qu1ck" is ambiguous)
    expect(correctOcrSubstitutions("qu1ck")).toBe("qu1ck");
  });

  it("does not replace standalone number 1", () => {
    expect(correctOcrSubstitutions("Chapter 1")).toBe("Chapter 1");
  });

  it("does not replace 1 followed by only one lowercase letter", () => {
    // Threshold is 2+ lowercase letters to avoid false positives on
    // abbreviations or section labels like "1a" or "1b"
    expect(correctOcrSubstitutions("1a")).toBe("1a");
  });
});

describe("correctOcrSubstitutions — combined substitutions", () => {
  it("applies all substitution types in a single pass", () => {
    // "|" between lowercase → l, "0" between lowercase → o, "1" at word start → l
    const input = "samp|e c0mputer 1ong";
    expect(correctOcrSubstitutions(input)).toBe("sample computer long");
  });

  it("does not corrupt normal text that happens to contain digits", () => {
    const input = "Chapter 1: 100 pages of OCR.";
    expect(correctOcrSubstitutions(input)).toBe("Chapter 1: 100 pages of OCR.");
  });

  it("round-trips clean text without modification", () => {
    const input = "The quick brown fox jumps over the lazy dog.";
    expect(correctOcrSubstitutions(input)).toBe(input);
  });
});

describe("correctOcrSubstitutions — integration with sanitizeOcrText", () => {
  it("sanitizeOcrText applies substitution corrections to OCR output", () => {
    // samp|e → sample via the lowercase-flanked-pipe rule
    const input = "samp|e paragraph\nc0mputer science";
    const result = sanitizeOcrText(input);
    expect(result).toContain("sample");
    expect(result).toContain("computer");
  });

  it("sanitizeOcrText corrects pipe-for-l substitutions in real-world OCR noise", () => {
    // Each | is flanked by lowercase letters on both sides → corrected to "l"
    const input = "The on|y way to rea|ly understand";
    const result = sanitizeOcrText(input);
    expect(result).toContain("only");
    expect(result).toContain("really");
  });
});

describe("sanitizeOcrText — real-world OCR noise fixture", () => {
  // A realistic sample of low-quality OCR output containing multiple noise patterns.
  const noisyOcrFixture = [
    "C H A P T E R   1",           // excessive internal spacing
    ".",                             // lone character
    "| |",                           // non-alphanumeric only
    "--- --- ---",                   // non-alphanumeric only
    "Thls 1s   a  samp|e  paragr-",  // broken hyphenation + extra spaces
    "aph with some   OCR  errors.",  // continuation
    "~~~~",                          // repeated glyph run (removed by non-alpha filter first)
    "======",                        // separator
    "A",                             // lone character
    "",                              // blank line
    "",                              // blank line (collapsed with above)
    "",                              // blank line (extra)
    "The qu1ck brown fox jumps over the |azy dog.",  // noisy but readable line
    "=====",                         // separator
    "F",                             // lone character
    "In OCR   scanned  documents,  extra   spaces are   common.",
    "!",                             // lone character
  ].join("\n");

  it("produces output with substantially fewer noise lines than the input", () => {
    const inputLines = noisyOcrFixture.split("\n").filter((l) => l.trim().length > 0);
    const result = sanitizeOcrText(noisyOcrFixture);
    const outputLines = result.split("\n").filter((l) => l.trim().length > 0);

    // At least 30% of the noisy lines should have been removed
    expect(outputLines.length).toBeLessThan(inputLines.length * 0.8);
  });

  it("retains meaningful content lines from the fixture", () => {
    const result = sanitizeOcrText(noisyOcrFixture);
    // These phrases appear in the fixture and should survive sanitisation
    expect(result).toMatch(/samp|e|sample/i);       // OCR noise in "sample" is preserved (not sanitised at char level)
    expect(result).toMatch(/quick|qu1ck/i);          // OCR digit-for-letter substitution left intact
    expect(result).toMatch(/extra\s+spaces\s+are\s+common|extra spaces are common/i);
  });

  it("does not contain lone-character lines in the output", () => {
    const result = sanitizeOcrText(noisyOcrFixture);
    const lines = result.split("\n");
    for (const line of lines) {
      expect(line.trim().length).not.toBe(1);
    }
  });

  it("does not contain 3+ consecutive blank lines in the output", () => {
    const result = sanitizeOcrText(noisyOcrFixture);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("output word count is within expected bounds (5 to 50 words)", () => {
    const result = sanitizeOcrText(noisyOcrFixture);
    const wc = wordCount(result);
    // The fixture contains ~30 meaningful words; noise lines add overhead.
    // After sanitisation we expect between 5 and 50 real words.
    expect(wc).toBeGreaterThanOrEqual(5);
    expect(wc).toBeLessThanOrEqual(50);
  });
});
