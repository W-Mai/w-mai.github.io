/**
 * Search engine module for blog full-text search.
 * Provides index types, MDX stripping, and MiniSearch integration.
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

/**
 * Strip MDX/HTML markup from raw content, returning plain text.
 *
 * Steps:
 * 1. Remove frontmatter (---...---)
 * 2. Remove import/export statements
 * 3. Remove JSX/HTML tags
 * 4. Remove Markdown syntax markers (#, *, `, []() etc.)
 * 5. Collapse whitespace
 */
export function stripMdx(raw: string): string {
  let text = raw;

  // 1. Remove frontmatter blocks (--- ... ---)
  text = text.replace(/^---[\s\S]*?---/gm, '');

  // 2. Remove import/export statements (single and multi-line)
  text = text.replace(/^(?:import|export)\s+.*$/gm, '');

  // 3. Remove JSX/HTML tags (self-closing and paired)
  text = text.replace(/<[^>]+>/g, '');

  // 4. Remove Markdown syntax markers
  // Headings: ## heading
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Images: ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Links: [text](url)
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Fenced code blocks (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, '');
  // Inline code: `code`
  text = text.replace(/`([^`]*)`/g, '$1');
  // Bold: **text** or __text__
  text = text.replace(/\*\*([^*]*)\*\*/g, '$1');
  text = text.replace(/__([^_]*)__/g, '$1');
  // Italic: *text* or _text_
  text = text.replace(/\*([^*]*)\*/g, '$1');
  text = text.replace(/_([^_]*)_/g, '$1');
  // Strikethrough: ~~text~~
  text = text.replace(/~~([^~]*)~~/g, '$1');
  // Horizontal rules: ---, ***, ___
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // Blockquotes: > text
  text = text.replace(/^>\s?/gm, '');
  // Unordered list markers: - item, * item, + item
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  // Ordered list markers: 1. item
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  // Custom sticker syntax: ::sticker[...]:: and :sticker[...]:
  text = text.replace(/::?sticker\[[^\]]*\]::?/g, '');

  // 5. Collapse whitespace
  text = text.replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim();

  return text;
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
