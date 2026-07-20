export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.split(/\s+/).length >= 8);
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
