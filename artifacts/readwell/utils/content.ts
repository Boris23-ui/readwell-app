import { Book, PdfPage, Segment } from '@/types';

export function splitIntoParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  // 1. Standard blank-line separated paragraphs
  const byBlankLines = normalized
    .split(/\n{2,}/)
    .map(p => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.split(/\s+/).length >= 8);

  if (byBlankLines.length >= 2) {
    return byBlankLines;
  }

  // 2. Fallback: single-newline separated lines (common when copying from PDFs/articles)
  const bySingleLines = normalized
    .split(/\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.split(/\s+/).length >= 8);

  if (bySingleLines.length >= 2) {
    return bySingleLines;
  }

  // 3. Fallback: single long wall of prose — split cleanly at sentence boundaries
  const singleBlock = normalized.replace(/\s+/g, ' ').trim();
  const totalWords = singleBlock.split(/\s+/).filter(Boolean).length;
  if (totalWords >= 50) {
    const sentences = singleBlock
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (sentences.length >= 2) {
      const targetPerPara = Math.max(2, Math.min(4, Math.ceil(sentences.length / 3)));
      const chunks: string[] = [];
      let current: string[] = [];
      let currentWords = 0;

      for (const sentence of sentences) {
        current.push(sentence);
        currentWords += sentence.split(/\s+/).length;
        if (current.length >= targetPerPara || currentWords >= 75) {
          chunks.push(current.join(' '));
          current = [];
          currentWords = 0;
        }
      }
      if (current.length > 0) {
        if (chunks.length > 0 && currentWords < 15) {
          chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${current.join(' ')}`;
        } else {
          chunks.push(current.join(' '));
        }
      }

      if (chunks.length >= 2) {
        return chunks;
      }
    }
  }

  return byBlankLines.length > 0 ? byBlankLines : bySingleLines;
}

export const STARTER_BOOK_ID = 'starter-art-of-deep-reading';

const STARTER_PARAGRAPHS = [
  'Modern feeds train our brains to expect a small burst of novelty every few seconds. When we sit down with a long article or a book, that same restless rhythm makes our eyes glide across lines without registering what they mean. Deep reading is not a talent reserved for scholars; it is a skill that comes back quickly once you give your attention a clear cadence.',
  'Psychologists studying memory have found a consistent pattern called the testing effect. Simply rereading a highlighted page feels productive because the sentences look familiar, yet familiarity fades within hours. Pausing after a short passage to retrieve an idea in your own words forces the brain to rebuild the pathway, which anchors the concept far more reliably.',
  'The secret to making retrieval feel rewarding rather than stressful is chunk size. If you wait until the end of a forty-page chapter to check whether you followed the argument, small misunderstandings compound into frustration. Checking in after five paragraphs turns comprehension into a series of light checkpoints that keep momentum alive.',
  'Context also transforms how we absorb unfamiliar vocabulary. Looking up a word in isolation rarely sticks, because the mind stores meaning through associations and contrast. Noticing how an author uses a word to shift the tone of a sentence lets you infer its nuance and recall it the next time you encounter it.',
  'Consistency beats marathon sessions almost every time. Reading attentively for fifteen minutes every evening builds over ninety hours of focused reading across a year—enough to finish a dozen substantial books. Start small, protect the streak, and let curiosity pull you into the next page.',
  'Great readers also treat a book as a conversation rather than a monologue. When a claim surprises you, pause and ask what assumption sits beneath it, or how it connects to something you observed in your own life. That brief habit of questioning shifts you from passive consumption into active synthesis.',
  'When you notice your mind drifting—thinking about messages, errands, or tomorrow’s schedule—resist the urge to judge yourself harshly. Gently mark the last sentence you truly understood, take a single slow breath, and re-enter the paragraph from there. Calm redirection builds far stronger focus than willpower alone.',
  'Over time, small daily sessions reshape how you approach difficult texts. Dense technical guides, classic novels, and long essays stop feeling like walls to climb all at once and start looking like paths made of manageable steps. Every segment you finish and reflect on compounds into lasting knowledge.',
];

export function createStarterBook(): Book {
  const rawSegments = groupIntoSegments(STARTER_PARAGRAPHS, 5);
  const segments: Segment[] = rawSegments.map((paragraphs, index) => ({
    index,
    paragraphs,
  }));
  const content = STARTER_PARAGRAPHS.join('\n\n');
  return {
    id: STARTER_BOOK_ID,
    title: 'The Art of Deep Reading',
    author: 'ReadWell Starter Guide',
    content,
    segments,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    wordCount: countWords(content),
    currentSegmentIndex: 0,
    coverColor: '#CF6D4D',
    sourceType: 'text',
  };
}

export function groupIntoSegments(paragraphs: string[], size = 5): string[][] {
  const segments: string[][] = [];
  for (let i = 0; i < paragraphs.length; i += size) {
    segments.push(paragraphs.slice(i, i + size));
  }
  // Merge last segment into previous if it has fewer than 2 paragraphs
  if (segments.length > 1 && segments[segments.length - 1].length < 2) {
    const last = segments.pop()!;
    segments[segments.length - 1].push(...last);
  }
  return segments;
}

// Groups PDF pages into reading sections mapped to page ranges. Each section's
// paragraphs hold the combined page text so the quiz generator keeps working.
export function buildPdfSegments(pages: PdfPage[], pagesPerSegment = 3): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < pages.length; i += pagesPerSegment) {
    const group = pages.slice(i, i + pagesPerSegment);
    const combinedText = group
      .map(p => p.text)
      .filter(t => t && t.trim().length > 0)
      .join('\n\n');
    const paragraphs = combinedText
      .split(/\n{2,}/)
      .map(p => p.replace(/\n/g, ' ').trim())
      .filter(p => p.length > 0);
    segments.push({
      index: segments.length,
      paragraphs: paragraphs.length > 0 ? paragraphs : [' '],
      pageStart: group[0].pageNumber,
      pageEnd: group[group.length - 1].pageNumber,
    });
  }
  return segments;
}

export interface PdfQualityWarning {
  lowConfidencePageCount: number;
  pageCount: number;
}

/** The fraction of blurry pages that triggers an advisory import warning. */
export const LOW_CONFIDENCE_WARNING_FRACTION = 0.3;

/**
 * Returns an import-time warning when low-confidence pages are common enough
 * that quiz sections may be affected.
 */
export function getPdfQualityWarning(
  pages: Array<Pick<PdfPage, 'lowConfidence'>>,
): PdfQualityWarning | null {
  const pageCount = pages.length;
  const lowConfidencePageCount = pages.filter(page => page.lowConfidence === true).length;

  if (
    pageCount === 0 ||
    lowConfidencePageCount / pageCount <= LOW_CONFIDENCE_WARNING_FRACTION
  ) {
    return null;
  }
  return { lowConfidencePageCount, pageCount };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export const COVER_COLORS = [
  '#E07B39', '#3B82F6', '#22C55E', '#8B5CF6',
  '#EF4444', '#F59E0B', '#06B6D4', '#EC4899',
];

export function randomCoverColor(): string {
  return COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
}

export function estimateReadMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Checks whether segment text has sufficient quality for quiz generation.
 * Returns true when the text is too garbled or blurry to produce a useful quiz.
 *
 * Signals checked:
 * 1. Word count — OCR noise often yields very few meaningful tokens.
 * 2. Alphabetic-character ratio — garbled text is full of symbols / numbers.
 * 3. Legible words with vowels — blurry OCR produces vowel-less strings.
 * 4. Vocabulary diversity — detects repetitive OCR hallucination loops.
 */
export function isTextQualityTooLow(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  // Must have at least 30 words
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 30) return true;

  // At least 45 % of all characters must be alphabetic letters
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) ?? []).length;
  const ratio = alphaCount / trimmed.length;
  if (ratio < 0.45) return true;

  // Check for legible words with vowels (guarding against gibberish OCR strings)
  const legibleWords = words.filter(w => {
    const clean = w.replace(/^[^\w]+|[^\w]+$/g, '');
    return (
      clean.length >= 2 &&
      /[a-zA-Z]{2,}/.test(clean) &&
      /[aeiouy]/i.test(clean) &&
      !/[bcdfghjklmnpqrstvwxz]{5,}/i.test(clean)
    );
  });
  if (legibleWords.length < 20) return true;

  // Vocabulary richness (guard against repetitive hallucination loops like "echo echo...")
  const uniqueWords = new Set(legibleWords.map(w => w.toLowerCase()));
  if (uniqueWords.size < 6) return true;

  return false;
}
