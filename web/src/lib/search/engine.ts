/**
 * Search engine module for blog full-text search.
 * Provides index types and MiniSearch integration for the browser.
 */

import MiniSearch from 'minisearch';

/** Content type for search index entries */
export type SearchEntryType = 'blog' | 'thought' | 'friend' | 'wish';

/** Shape of each entry in the search index JSON */
export interface SearchIndexEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  body: string;
  slug: string;
  type: SearchEntryType;
}

/** Shape of each search result returned to the UI */
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  slug: string;
  score: number;
  type: SearchEntryType;
}

// Regex matching contiguous CJK Unified Ideographs
const CJK_RANGE_RE = /[\u4e00-\u9fff]+/g;

/**
 * Custom tokenizer supporting both English and Chinese text.
 * - English segments: split by whitespace and punctuation
 * - Chinese segments: generate individual characters AND bigrams
 *   for substring matching without a segmentation library
 */
function tokenize(text: string): string[] {
  if (!text) return [];

  const tokens: string[] = [];

  // Extract and tokenize Chinese segments
  const cjkMatches = text.match(CJK_RANGE_RE);
  if (cjkMatches) {
    for (const segment of cjkMatches) {
      // Individual characters
      for (const char of segment) {
        tokens.push(char);
      }
      // Bigrams for better substring matching
      for (let i = 0; i < segment.length - 1; i++) {
        tokens.push(segment[i] + segment[i + 1]);
      }
    }
  }

  // Extract and tokenize non-Chinese segments (English, etc.)
  const nonCjk = text.replace(CJK_RANGE_RE, ' ');
  const englishTokens = nonCjk
    .split(/[\s\-_.,;:!?'"()\[\]{}<>@#$%^&*+=|\\\/~`]+/)
    .filter((t) => t.length > 0);
  tokens.push(...englishTokens);

  return tokens;
}

/** Internal shape used for MiniSearch indexing (tags joined as string) */
interface IndexDocument {
  id: string;
  title: string;
  description: string;
  tags: string;
  body: string;
  slug: string;
  type: SearchEntryType;
}

/**
 * Create and populate a MiniSearch instance from search index entries.
 * Joins tags array into a space-separated string for indexing.
 */
export function createSearchEngine(entries: SearchIndexEntry[]): MiniSearch<IndexDocument> {
  const engine = new MiniSearch<IndexDocument>({
    fields: ['title', 'description', 'tags', 'body'],
    storeFields: ['title', 'description', 'slug', 'type'],
    tokenize,
    searchOptions: {
      boost: { title: 3, tags: 2, description: 1.5, body: 1 },
      fuzzy: 0.2,
      prefix: true,
      tokenize,
    },
  });

  // Convert tags array to joined string before adding to index
  const docs: IndexDocument[] = entries.map((entry) => ({
    ...entry,
    tags: entry.tags.join(' '),
  }));

  engine.addAll(docs);
  return engine;
}

/**
 * Execute a search query against the engine, returning at most 10 results.
 * Returns empty array for empty/whitespace-only queries.
 */
export function search(engine: MiniSearch<IndexDocument>, query: string): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = engine.search(trimmed);

  return results.slice(0, 10).map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? '',
    description: (r.description as string) ?? '',
    slug: (r.slug as string) ?? '',
    score: r.score,
    type: (r.type as SearchEntryType) ?? 'blog',
  }));
}
