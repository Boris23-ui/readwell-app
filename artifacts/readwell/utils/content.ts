import { Book, PdfPage, Segment } from '@/types';

export type BookBlockType =
  | 'heading'
  | 'subheading'
  | 'callout'
  | 'quote'
  | 'list-item'
  | 'divider'
  | 'paragraph';

export type CalloutKind = 'definition' | 'theorem' | 'example' | 'note';

export interface BookBlock {
  id: string;
  type: BookBlockType;
  text: string;
  /** Label for callouts, e.g. "DEFINITION 1", "THEOREM", "EXAMPLE 2" */
  label?: string;
  calloutKind?: CalloutKind;
  /** Bullet or number marker for list items, e.g. "1.", "•", "(a)" */
  marker?: string;
  /** Optional quote attribution */
  attribution?: string;
  /** True for the first body paragraph of a section or right after a heading */
  isOpeningParagraph?: boolean;
  /** 1-based sequential paragraph index among prose paragraphs in the section */
  paragraphNumber?: number;
}

const ABBREVIATIONS_REGEX = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Fig|Figs|Eq|Eqs|Ch|Sec|Vol|No|vs|etc|al|e\.g|i\.e|U\.S|D\.C)\.$/i;

const SCENE_BREAK_REGEX = /^\s*(?:\*\s*\*\s*\*+|-{3,}|—{2,}|•\s*•\s*•+|❖+|❦+|✦(?:\s*✦)*)\s*$/;

const MAJOR_HEADING_REGEX =
  /^(?:(?:CHAPTER|PART|UNIT|MODULE|APPENDIX|BOOK)\s+(?:[IVXLCDM]+|\d+)(?:\s*[:.—–-]\s*|\s+).{0,80}|(?:CHAPTER|PART|PROLOGUE|EPILOGUE|INTRODUCTION|PREFACE|FOREWORD|AFTERWORD)(?:\s+[IVXLCDM\d]+)?)$/i;

const NUMBERED_SUBHEADING_REGEX =
  /^(\d{1,2}(?:\.\d{1,2}){1,3})\s+([A-Z][A-Za-z0-9\s,&/():'’-]{2,65})$/;

const CALLOUT_PREFIX_REGEX =
  /^((?:DEFINITION|THEOREM|LEMMA|COROLLARY|PROPOSITION|AXIOM|EXAMPLE|EXERCISE|PROOF|REMARK|NOTE|KEY\s+CONCEPT|KEY\s+TAKEAWAY|PRINCIPLE)(?:(?:\s+\d+(?:\.\d+)*(?:\s*\([^)]{1,45}\))?\s*(?:[:.—–-]\s*|\s+))|(?:\s*\([^)]{1,45}\))?\s*[:.—–-]\s*))(.+)$/i;

const LIST_ITEM_PREFIX_REGEX =
  /^(?:([•●▪▸*-]|\d{1,2}\.|[a-z]\)|\([a-z0-9]{1,3}\)|[ivx]{1,4}\.)\s+)(.+)$/i;

const STANDALONE_PAGE_NUMBER_REGEX =
  /^\s*(?:page\s+\d+(?:\s+of\s+\d+)?|[-–—]?\s*\d{1,4}\s*[-–—]?)\s*$/i;

/**
 * Cleans raw PDF/OCR text artifacts: normalizes newlines, heals hyphenated line wraps,
 * and removes isolated running page number lines.
 */
export function cleanRawBookText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n\n')
    // Heal word hyphenation across line wraps (e.g. "compre-\nhension" -> "comprehension")
    .replace(/([a-zA-Z]{2,})-[ \t]*\n[ \t]*([a-z]{2,})/g, '$1$2')
    .split('\n')
    .filter(line => !STANDALONE_PAGE_NUMBER_REGEX.test(line))
    .join('\n')
    .trim();
}

/**
 * Splits a block of prose into individual sentences while respecting common abbreviations
 * and decimal numbers.
 */
export function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const rawParts = normalized.split(/(?<=[.!?]["”’)]?)\s+(?=[A-Z0-9"“‘(])/);
  const sentences: string[] = [];

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (
      sentences.length > 0 &&
      ABBREVIATIONS_REGEX.test(sentences[sentences.length - 1])
    ) {
      sentences[sentences.length - 1] = `${sentences[sentences.length - 1]} ${trimmed}`;
    } else {
      sentences.push(trimmed);
    }
  }

  return sentences;
}

/**
 * Breaks a single flattened string (such as a full PDF page where single newlines
 * were previously collapsed into spaces) into distinct structural lines and
 * human-sized prose paragraphs (~45-80 words, 2-3 sentences each).
 */
export function expandFlattenedBlock(rawBlock: string): string[] {
  let block = rawBlock.replace(/\s+/g, ' ').trim();
  if (!block) return [];

  // 1. Separate leading CHAPTER / PART heading glued to a section heading or opening sentence
  // e.g. "CHAPTER 1 The Foundations: Logic and Proofs 1.1 Propositional Logic The rules..."
  block = block.replace(
    /^((?:CHAPTER|PART|UNIT|MODULE)\s+(?:[IVXLCDM]+|\d+)\s+[A-Z][^.!?\n]{2,60}?)\s+(?=\d{1,2}\.\d{1,2}\s+[A-Z])/i,
    '$1\n',
  );

  // 2. Separate leading numbered section subheading glued to the first prose sentence
  // e.g. "1.1 Propositional Logic The rules of logic give..."
  block = block.replace(
    /(^|\n)(\d{1,2}(?:\.\d{1,2}){1,2}\s+[A-Z][A-Za-z0-9\s,&/-]{2,48}?)\s+(?=(?:The|A|An|In|We|To|For|When|If|Let|Suppose|Consider|Because|Since|Every|All|Many|Most|This|These|It|As|By|From|On|With|One|Two|Recall|Note|Here|There|Although|While|However|Modern|Psychologists)\b)/g,
    '$1$2\n',
  );

  // 3. Separate embedded mid-block numbered section headings after a period
  block = block.replace(
    /(?<=[.!?])\s+(?=\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s+[A-Z][a-z]+)/g,
    '\n',
  );

  // 4. Separate embedded CALLOUT headers (DEFINITION 1, Theorem 2:, Example 1.1, Proof:, etc.)
  block = block.replace(
    /(?<=[.!?])\s+(?=(?:DEFINITION|THEOREM|LEMMA|COROLLARY|PROPOSITION|AXIOM|EXAMPLE|EXERCISE|PROOF|REMARK|Definition|Theorem|Lemma|Corollary|Proposition|Axiom|Example|Exercise|Proof|Remark)(?:\s+\d+(?:\.\d+)*|\s*:))/g,
    '\n',
  );

  // 5. Separate inline numbered or bulleted list items following sentence punctuation
  // e.g. "...are propositions. 1. Washington, D.C., is... 2. Toronto is..."
  block = block.replace(
    /(?<=[.!?:])\s+(?=(?:\d{1,2}\.\s+[A-Z0-9(]|\([a-z0-9]\)\s+[A-Z0-9]|[•●▪]\s+))/g,
    '\n',
  );

  const subLines = block
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const output: string[] = [];

  for (const line of subLines) {
    // Keep headings, scene breaks, and list items intact as their own units
    if (
      SCENE_BREAK_REGEX.test(line) ||
      MAJOR_HEADING_REGEX.test(line) ||
      NUMBERED_SUBHEADING_REGEX.test(line) ||
      LIST_ITEM_PREFIX_REGEX.test(line)
    ) {
      output.push(line);
      continue;
    }

    // If a line starts with a callout (DEFINITION 1, THEOREM 2, EXAMPLE 1, NOTE:, etc.)
    // and has trailing body prose attached from a flattened PDF page, separate the
    // concise callout statement from the subsequent explanatory prose paragraphs.
    const words = line.split(/\s+/).filter(Boolean);
    if (CALLOUT_PREFIX_REGEX.test(line)) {
      const calloutSentences = splitIntoSentences(line);
      if (calloutSentences.length >= 2 && words.length > 32) {
        const firstSentenceWords = calloutSentences[0].split(/\s+/).length;
        const calloutSentenceCount = firstSentenceWords < 14 && calloutSentences.length >= 3 ? 2 : 1;
        const calloutUnit = calloutSentences.slice(0, calloutSentenceCount).join(' ');
        const trailingProse = calloutSentences.slice(calloutSentenceCount).join(' ');
        output.push(calloutUnit);
        if (trailingProse.trim()) {
          output.push(...expandFlattenedBlock(trailingProse));
        }
        continue;
      }
      output.push(line);
      continue;
    }

    if (words.length <= 85) {
      output.push(line);
      continue;
    }

    const sentences = splitIntoSentences(line);
    if (sentences.length < 2) {
      output.push(line);
      continue;
    }

    const targetPerPara = Math.max(2, Math.min(3, Math.ceil(sentences.length / Math.ceil(words.length / 65))));
    let current: string[] = [];
    let currentWords = 0;

    for (const sentence of sentences) {
      current.push(sentence);
      currentWords += sentence.split(/\s+/).length;
      if (current.length >= targetPerPara || currentWords >= 68) {
        output.push(current.join(' '));
        current = [];
        currentWords = 0;
      }
    }

    if (current.length > 0) {
      if (output.length > 0 && currentWords < 15 && !MAJOR_HEADING_REGEX.test(output[output.length - 1])) {
        output[output.length - 1] = `${output[output.length - 1]} ${current.join(' ')}`;
      } else {
        output.push(current.join(' '));
      }
    }
  }

  return output;
}

/**
 * Parses lines within a blank-line-separated chunk so that PDF pages containing
 * single-newline paragraph breaks, headings, definitions, or lists are not
 * flattened into a single run-on wall of text.
 */
function extractParagraphsFromChunk(chunk: string): string[] {
  const lines = chunk
    .split(/\n+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  if (lines.length === 1) {
    return expandFlattenedBlock(lines[0]);
  }

  // Check if the non-structural lines in the chunk are already distinct full-sentence
  // paragraphs separated by single newlines (even if the chunk starts with a short heading).
  const isStructuralUnit = (l: string) =>
    SCENE_BREAK_REGEX.test(l) ||
    MAJOR_HEADING_REGEX.test(l) ||
    NUMBERED_SUBHEADING_REGEX.test(l) ||
    CALLOUT_PREFIX_REGEX.test(l) ||
    LIST_ITEM_PREFIX_REGEX.test(l);

  const proseLines = lines.filter(l => !isStructuralUnit(l));
  const longProseLines = proseLines.filter(l => l.split(/\s+/).length >= 8);
  const terminalProseLines = longProseLines.filter(l => /[.!?”’"')]$/.test(l));
  const hasUnwrappedLineWidth = proseLines.some(l => l.length >= 75);

  if (
    proseLines.length >= 2 &&
    longProseLines.length === proseLines.length &&
    terminalProseLines.length >= Math.ceil(proseLines.length * 0.7) &&
    (hasUnwrappedLineWidth || terminalProseLines.length === proseLines.length)
  ) {
    return lines.flatMap(l => expandFlattenedBlock(l));
  }

  // Otherwise, reconstruct paragraphs from hard-wrapped PDF lines while respecting
  // headings, callouts, list items, and sentence-ending paragraph breaks.
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      const joined = buffer.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) {
        paragraphs.push(...expandFlattenedBlock(joined));
      }
      buffer = [];
      bufferWords = 0;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWords = line.split(/\s+/).length;
    const isStructuralLine =
      SCENE_BREAK_REGEX.test(line) ||
      MAJOR_HEADING_REGEX.test(line) ||
      NUMBERED_SUBHEADING_REGEX.test(line) ||
      CALLOUT_PREFIX_REGEX.test(line) ||
      LIST_ITEM_PREFIX_REGEX.test(line);

    if (isStructuralLine) {
      flushBuffer();
      if (
        MAJOR_HEADING_REGEX.test(line) ||
        NUMBERED_SUBHEADING_REGEX.test(line) ||
        SCENE_BREAK_REGEX.test(line)
      ) {
        paragraphs.push(line);
      } else {
        buffer.push(line);
        bufferWords += lineWords;
      }
      continue;
    }

    buffer.push(line);
    bufferWords += lineWords;

    const endsWithSentence = /[.!?]["”’)]?$/.test(line);
    const nextLine = lines[i + 1];
    const nextStartsNewSentence = nextLine ? /^[A-Z0-9"“‘(]/.test(nextLine) : false;
    const isShortEndingLine = line.length < 58 && endsWithSentence;
    const isUnwrappedCompleteParagraphLine = line.length >= 80 && lineWords >= 12 && endsWithSentence;

    if (
      endsWithSentence &&
      nextStartsNewSentence &&
      (bufferWords >= 45 || isShortEndingLine || isUnwrappedCompleteParagraphLine)
    ) {
      flushBuffer();
    }
  }

  flushBuffer();
  return paragraphs;
}

export function splitIntoParagraphs(text: string): string[] {
  const normalized = cleanRawBookText(text);
  if (!normalized) return [];

  // 1. Split by blank lines first, then intelligently unpack any multi-paragraph PDF page chunks
  const rawChunks = normalized.split(/\n{2,}/).map(c => c.trim()).filter(Boolean);

  if (rawChunks.length >= 2) {
    const unpacked = rawChunks
      .flatMap(chunk => extractParagraphsFromChunk(chunk))
      .filter(p => p.split(/\s+/).length >= 8 || MAJOR_HEADING_REGEX.test(p) || NUMBERED_SUBHEADING_REGEX.test(p));

    if (unpacked.length >= 2) {
      return unpacked;
    }
  }

  // 2. Fallback: single-newline separated lines or single multi-line chunk
  if (rawChunks.length === 1) {
    const fromSingleChunk = extractParagraphsFromChunk(rawChunks[0]).filter(
      p => p.split(/\s+/).length >= 8 || MAJOR_HEADING_REGEX.test(p) || NUMBERED_SUBHEADING_REGEX.test(p),
    );
    if (fromSingleChunk.length >= 2) {
      return fromSingleChunk;
    }
  }

  const bySingleLines = normalized
    .split(/\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.split(/\s+/).length >= 8);

  if (bySingleLines.length >= 2) {
    return bySingleLines.flatMap(line => expandFlattenedBlock(line));
  }

  // 3. Fallback: single long wall of prose — split cleanly at sentence boundaries
  const singleBlock = normalized.replace(/\s+/g, ' ').trim();
  const totalWords = singleBlock.split(/\s+/).filter(Boolean).length;
  if (totalWords >= 50) {
    const expanded = expandFlattenedBlock(singleBlock);
    if (expanded.length >= 2) {
      return expanded;
    }

    const sentences = splitIntoSentences(singleBlock);
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

  const byBlankLines = rawChunks
    .map(p => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(p => p.split(/\s+/).length >= 8);

  return byBlankLines.length > 0 ? byBlankLines : bySingleLines;
}

/**
 * Extracts a classic book Drop Cap letter and opening 2-3 lead-in words
 * from the first paragraph of a section.
 */
export function extractParagraphLeadIn(text: string): {
  dropCap: string;
  leadWords: string;
  rest: string;
} {
  const trimmed = text.trim();
  // Match optional opening quote + first alphanumeric letter + rest of text
  const match = trimmed.match(/^([“"‘'()]?[A-Za-z])(.*)$/s);
  if (!match) {
    return { dropCap: '', leadWords: '', rest: trimmed };
  }

  const dropCap = match[1];
  const remainder = match[2];
  const hasLeadingSpace = /^\s/.test(remainder);
  const tokens = remainder.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return { dropCap, leadWords: '', rest: '' };
  }

  const leadWordCount = Math.min(3, tokens.length);
  const leadWords = `${hasLeadingSpace ? ' ' : ''}${tokens.slice(0, leadWordCount).join(' ')}`;
  const restTokens = tokens.slice(leadWordCount);
  const rest = restTokens.length > 0 ? ` ${restTokens.join(' ')}` : '';

  return {
    dropCap,
    leadWords,
    rest,
  };
}

function classifyCalloutKind(rawType: string): CalloutKind {
  const upper = rawType.toUpperCase();
  if (upper.startsWith('DEF') || upper.startsWith('AXIOM') || upper.startsWith('PRINCIPLE')) {
    return 'definition';
  }
  if (
    upper.startsWith('THEOREM') ||
    upper.startsWith('LEMMA') ||
    upper.startsWith('COROLLARY') ||
    upper.startsWith('PROPOSITION') ||
    upper.startsWith('PROOF')
  ) {
    return 'theorem';
  }
  if (upper.startsWith('EXAMPLE') || upper.startsWith('EXERCISE')) {
    return 'example';
  }
  return 'note';
}

/**
 * Converts a segment's raw paragraph strings into structured, book-like blocks
 * (headings, subheadings, callouts, quotes, list items, section dividers, and
 * numbered/indented paragraphs).
 *
 * Works seamlessly on both newly imported books AND legacy saved books whose
 * segments contain unsplit PDF page walls.
 */
export function formatSegmentForBookReader(rawParagraphs: string[]): BookBlock[] {
  if (!Array.isArray(rawParagraphs) || rawParagraphs.length === 0) return [];

  // Step 1: Expand any flattened / oversized blocks into clean logical units
  const expandedUnits: string[] = [];
  for (const raw of rawParagraphs) {
    if (typeof raw !== 'string') continue;
    const cleaned = cleanRawBookText(raw);
    if (!cleaned) continue;

    // If the string contains newlines, process chunk-by-chunk
    const subChunks = cleaned.split(/\n{2,}/).map(c => c.trim()).filter(Boolean);
    for (const chunk of subChunks) {
      expandedUnits.push(...extractParagraphsFromChunk(chunk));
    }
  }

  if (expandedUnits.length === 0) return [];

  // Step 2: Classify each unit into a rich BookBlock
  const preliminaryBlocks: Omit<BookBlock, 'id'>[] = [];

  for (const unit of expandedUnits) {
    const trimmed = unit.trim();
    if (!trimmed) continue;

    // 1. Explicit scene break
    if (SCENE_BREAK_REGEX.test(trimmed)) {
      preliminaryBlocks.push({ type: 'divider', text: '✦   ✦   ✦' });
      continue;
    }

    // 2. Major Chapter / Part heading
    if (MAJOR_HEADING_REGEX.test(trimmed)) {
      preliminaryBlocks.push({ type: 'heading', text: trimmed });
      continue;
    }

    // 3. Numbered section subheading (e.g. "1.1 Propositional Logic")
    if (NUMBERED_SUBHEADING_REGEX.test(trimmed)) {
      preliminaryBlocks.push({ type: 'subheading', text: trimmed });
      continue;
    }

    // 4. Academic / Non-fiction Callout (Definition, Theorem, Example, Proof, Note, etc.)
    const calloutMatch = trimmed.match(CALLOUT_PREFIX_REGEX);
    if (calloutMatch) {
      const rawLabel = calloutMatch[1]
        .replace(/\s*[:.—–-]+\s*$/, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
      const bodyText = calloutMatch[2].trim();
      preliminaryBlocks.push({
        type: 'callout',
        label: rawLabel,
        calloutKind: classifyCalloutKind(rawLabel),
        text: bodyText,
      });
      continue;
    }

    // 5. List item (numbered, lettered, or bulleted)
    const listMatch = trimmed.match(LIST_ITEM_PREFIX_REGEX);
    if (listMatch) {
      preliminaryBlocks.push({
        type: 'list-item',
        marker: listMatch[1],
        text: listMatch[2].trim(),
      });
      continue;
    }

    // 6. Blockquote (starts with ">" or wrapped entirely in quotes with attribution)
    if (trimmed.startsWith('>')) {
      const quoteBody = trimmed.replace(/^>\s*/, '').trim();
      preliminaryBlocks.push({
        type: 'quote',
        text: quoteBody,
      });
      continue;
    }
    const quoteWithAttribution = trimmed.match(/^[“"](.+)[”"]\s*(?:[—–-]{1,2}\s*(.+))$/);
    if (quoteWithAttribution) {
      preliminaryBlocks.push({
        type: 'quote',
        text: quoteWithAttribution[1].trim(),
        attribution: quoteWithAttribution[2].trim(),
      });
      continue;
    }

    // 7. Short title-like heading without sentence punctuation or dialogue quotes (e.g. "Propositional Equivalences")
    const wordCount = trimmed.split(/\s+/).length;
    if (
      wordCount >= 2 &&
      wordCount <= 8 &&
      trimmed.length <= 64 &&
      !/[.!?,;:)”"’'\]]$/.test(trimmed) &&
      !/[.!?]/.test(trimmed) &&
      !/["“”]/.test(trimmed) &&
      /^[A-Z0-9]/.test(trimmed)
    ) {
      preliminaryBlocks.push({ type: 'subheading', text: trimmed });
      continue;
    }

    // 8. Standard book paragraph
    preliminaryBlocks.push({
      type: 'paragraph',
      text: trimmed,
    });
  }

  // Step 3: Assign paragraph numbers, opening-paragraph drop-cap flags,
  // and insert subtle ornamental section dividers between long runs of prose paragraphs
  const finalBlocks: BookBlock[] = [];
  let proseCount = 0;
  let consecutiveProseRun = 0;
  let expectOpeningParagraph = true;
  const totalProseParagraphs = preliminaryBlocks.filter(b => b.type === 'paragraph').length;

  for (let i = 0; i < preliminaryBlocks.length; i++) {
    const block = preliminaryBlocks[i];

    if (block.type === 'heading' || block.type === 'subheading' || block.type === 'divider') {
      consecutiveProseRun = 0;
      if (block.type === 'heading') {
        expectOpeningParagraph = true;
      }
      finalBlocks.push({
        ...block,
        id: `block-${finalBlocks.length}`,
      });
      continue;
    }

    if (block.type === 'paragraph') {
      // Insert a classic editorial section divider after every 3 consecutive prose paragraphs
      // when there are still at least 2 prose paragraphs remaining in the section.
      const remainingProse = totalProseParagraphs - proseCount;
      if (consecutiveProseRun >= 3 && remainingProse >= 2) {
        finalBlocks.push({
          id: `block-${finalBlocks.length}`,
          type: 'divider',
          text: '✦   ✦   ✦',
        });
        consecutiveProseRun = 0;
      }

      proseCount += 1;
      consecutiveProseRun += 1;
      const isOpening = expectOpeningParagraph;
      expectOpeningParagraph = false;

      finalBlocks.push({
        ...block,
        id: `block-${finalBlocks.length}`,
        isOpeningParagraph: isOpening,
        paragraphNumber: proseCount,
      });
      continue;
    }

    // Callouts, quotes, and list items reset the consecutive prose counter without forcing a new drop cap
    if (block.type === 'callout' || block.type === 'quote') {
      consecutiveProseRun = 0;
    }

    finalBlocks.push({
      ...block,
      id: `block-${finalBlocks.length}`,
    });
  }

  return finalBlocks;
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
    const smartParagraphs = splitIntoParagraphs(combinedText);
    const paragraphs =
      smartParagraphs.length > 0
        ? smartParagraphs
        : combinedText
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
