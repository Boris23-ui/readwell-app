import { describe, expect, it } from 'vitest';
import {
  getPdfQualityWarning,
  LOW_CONFIDENCE_WARNING_FRACTION,
  isTextQualityTooLow,
  splitIntoParagraphs,
  createStarterBook,
  STARTER_BOOK_ID,
  formatSegmentForBookReader,
  extractParagraphLeadIn,
  cleanRawBookText,
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

  it('unpacks multi-page PDF text where pages are separated by blank lines but paragraphs use single newlines', () => {
    const pdfText =
      '1.1 Propositional Logic\n' +
      'The rules of logic give precise meaning to mathematical statements and arguments across computer science.\n' +
      'Because a major goal of this book is to teach the reader how to construct valid arguments, we begin with logic.\n\n' +
      '1.2 Propositional Equivalences\n' +
      'An important type of step used in a mathematical argument is the replacement of a statement with another equivalent one.\n' +
      'Two propositions are logically equivalent if they have the exact same truth value in every possible case.';
    const result = splitIntoParagraphs(pdfText);
    expect(result).toHaveLength(6);
  });

  it('returns fewer than 2 paragraphs for very short text', () => {
    expect(splitIntoParagraphs('Too short.')).toHaveLength(0);
  });
});

describe('formatSegmentForBookReader', () => {
  it('decomposes a flattened PDF textbook page into headings, paragraphs, callouts, and list items', () => {
    const flattenedPdfPage =
      'CHAPTER 1 The Foundations: Logic and Proofs 1.1 Propositional Logic ' +
      'The rules of logic give precise meaning to mathematical statements. These rules are used to distinguish between valid and invalid mathematical arguments. Because a major goal of this book is to teach the reader how to understand and how to construct correct mathematical arguments, we begin our study of discrete mathematics with an introduction to logic. ' +
      'Besides the importance of logic in understanding mathematical reasoning, logic has numerous applications to computer science. These rules are used in the design of computer circuits, the construction of computer programs, the verification of the correctness of programs, and in many other ways. ' +
      'DEFINITION 1 A proposition is a declarative sentence that is either true or false, but not both. ' +
      'EXAMPLE 1 All the following declarative sentences are propositions. ' +
      '1. Washington, D.C., is the capital of the United States of America. ' +
      '2. Toronto is the capital of Canada.';

    const blocks = formatSegmentForBookReader([flattenedPdfPage]);

    expect(blocks.some(b => b.type === 'heading' && b.text.includes('CHAPTER 1'))).toBe(true);
    expect(blocks.some(b => b.type === 'subheading' && b.text.includes('1.1 Propositional Logic'))).toBe(true);
    const proseBlocks = blocks.filter(b => b.type === 'paragraph');
    expect(proseBlocks.length).toBeGreaterThanOrEqual(2);
    expect(proseBlocks[0].isOpeningParagraph).toBe(true);
    expect(proseBlocks[0].paragraphNumber).toBe(1);
    expect(proseBlocks[1].paragraphNumber).toBe(2);

    const defCallout = blocks.find(b => b.type === 'callout' && b.calloutKind === 'definition');
    expect(defCallout).toBeDefined();
    expect(defCallout?.label).toBe('DEFINITION 1');

    const exCallout = blocks.find(b => b.type === 'callout' && b.calloutKind === 'example');
    expect(exCallout).toBeDefined();
    expect(exCallout?.label).toBe('EXAMPLE 1');

    const listItems = blocks.filter(b => b.type === 'list-item');
    expect(listItems).toHaveLength(2);
    expect(listItems[0].marker).toBe('1.');
    expect(listItems[1].marker).toBe('2.');
  });

  it('inserts an ornamental section divider in a 5-paragraph narrative segment and marks opening drop cap', () => {
    const book = createStarterBook();
    const blocks = formatSegmentForBookReader(book.segments[0].paragraphs);

    const proseBlocks = blocks.filter(b => b.type === 'paragraph');
    expect(proseBlocks).toHaveLength(5);
    expect(proseBlocks[0].isOpeningParagraph).toBe(true);
    expect(proseBlocks[1].isOpeningParagraph).toBe(false);

    const dividers = blocks.filter(b => b.type === 'divider');
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });

  it('handles quotes, explicit scene breaks, and empty inputs cleanly', () => {
    expect(formatSegmentForBookReader([])).toEqual([]);
    expect(formatSegmentForBookReader(['   '])).toEqual([]);

    const blocks = formatSegmentForBookReader([
      '"Reading furnishes the mind only with materials of knowledge; it is thinking that makes what we read ours." — John Locke',
      '* * *',
      'A regular paragraph following the scene break with plenty of clear words.',
    ]);

    expect(blocks[0].type).toBe('quote');
    expect(blocks[0].attribution).toBe('John Locke');
    expect(blocks[1].type).toBe('divider');
    expect(blocks[2].type).toBe('paragraph');
  });

  it('does not misclassify normal prose starting with "Note that" as a callout while recognizing "Note:"', () => {
    const blocks = formatSegmentForBookReader([
      'Note that the author uses a gentle metaphor to introduce the next chapter of the book.',
      'Note: Always verify that both sides of the logical equivalence hold under all truth assignments.',
    ]);

    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[1].type).toBe('callout');
    expect(blocks[1].label).toBe('NOTE');
  });

  it('does not misclassify short callouts or quoted dialogue sentences as subheadings', () => {
    const blocks = formatSegmentForBookReader([
      'NOTE: Check the truth table',
      'He whispered, "Let us begin."',
      'Propositional Equivalences',
    ]);

    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].label).toBe('NOTE');
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[2].type).toBe('subheading');
  });

  it('separates a definition callout from trailing explanatory body prose in a flattened PDF page', () => {
    const flattenedWithTrailingProse =
      'DEFINITION 1 A proposition is a declarative sentence that is either true or false, but not both. ' +
      'We use letters to denote propositional variables, just as we use letters to denote numerical variables. ' +
      'The conventional letters used for propositional variables are p, q, r, and s. ' +
      'The truth value of a proposition is true, denoted by T, if it is a true proposition, and false, denoted by F, if it is a false proposition.';

    const blocks = formatSegmentForBookReader([flattenedWithTrailingProse]);
    expect(blocks[0].type).toBe('callout');
    expect(blocks[0].label).toBe('DEFINITION 1');
    expect(blocks[0].text).toBe(
      'A proposition is a declarative sentence that is either true or false, but not both.',
    );
    expect(blocks.some(b => b.type === 'paragraph' && b.text.includes('We use letters to denote'))).toBe(true);
  });
});

describe('extractParagraphLeadIn & cleanRawBookText', () => {
  it('extracts the drop cap and opening lead-in words from a paragraph', () => {
    const lead = extractParagraphLeadIn('Modern feeds train our brains to expect novelty.');
    expect(lead.dropCap).toBe('M');
    expect(lead.leadWords).toBe('odern feeds train');
    expect(lead.rest).toBe(' our brains to expect novelty.');
  });

  it('preserves leading space and 3 full words when a paragraph starts with a single-letter word', () => {
    const lead = extractParagraphLeadIn('A proposition is a declarative sentence that is either true or false.');
    expect(lead.dropCap).toBe('A');
    expect(lead.leadWords).toBe(' proposition is a');
    expect(lead.rest).toBe(' declarative sentence that is either true or false.');
  });

  it('heals hyphenated line wraps and removes standalone page numbers', () => {
    const raw = 'Compre-\nhension is key.\nPage 42\n- 15 -\nNext line stays.';
    const cleaned = cleanRawBookText(raw);
    expect(cleaned).toContain('Comprehension is key.');
    expect(cleaned).not.toContain('Page 42');
    expect(cleaned).not.toContain('- 15 -');
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