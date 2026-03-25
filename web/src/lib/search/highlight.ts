/**
 * Highlight utility for marking query term matches within text.
 * Used by SearchDialog to render <mark> tags around matched keywords.
 */

/** A segment of text with a flag indicating whether it matched a query term */
export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Split text into segments with highlight markers for matched query terms.
 * Handles overlapping matches by merging ranges before segmenting.
 *
 * @param text - The source text to highlight within
 * @param query - Space-separated query terms to match (case-insensitive)
 * @returns Array of segments that concatenate to the original text
 */
export function highlightMatches(text: string, query: string): HighlightSegment[] {
  if (!text) return [];

  const trimmed = query.trim();
  if (!trimmed) return [{ text, highlighted: false }];

  const keywords = trimmed.split(/\s+/).filter((k) => k.length > 0);
  if (keywords.length === 0) return [{ text, highlighted: false }];

  // Collect all match ranges [start, end)
  const ranges: [number, number][] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    let pos = 0;
    while (pos < lowerText.length) {
      const idx = lowerText.indexOf(lowerKeyword, pos);
      if (idx === -1) break;
      ranges.push([idx, idx + lowerKeyword.length]);
      pos = idx + 1;
    }
  }

  if (ranges.length === 0) return [{ text, highlighted: false }];

  // Sort by start position, then by end (descending) to prefer longer ranges first
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  // Merge overlapping ranges
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = ranges[i];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  // Build segments from merged ranges
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const [start, end] of merged) {
    if (cursor < start) {
      segments.push({ text: text.slice(cursor, start), highlighted: false });
    }
    segments.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments;
}
