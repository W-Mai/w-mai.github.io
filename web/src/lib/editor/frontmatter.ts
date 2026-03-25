import type { Text } from '@codemirror/state';

/** Byte range of the frontmatter region in the document */
export interface FrontmatterRange {
  /** Offset of the first character of the opening `---` line */
  from: number;
  /** Offset past the newline of the closing `---` line */
  to: number;
  /** The raw YAML text between the delimiters (excluding `---` lines) */
  yamlText: string;
}

/**
 * Scan a CodeMirror Text object for a valid frontmatter region.
 * The opening `---` must be on line 0; the closing `---` must be on a
 * subsequent line containing only `---` and optional trailing whitespace.
 * Returns null when no valid frontmatter region is found.
 */
export function detectFrontmatterRange(doc: Text): FrontmatterRange | null {
  if (doc.lines < 2) return null;

  // Line 1 in CM Text is the first line (1-indexed)
  const firstLine = doc.line(1);
  if (firstLine.text.trim() !== '---') return null;

  // Scan subsequent lines for the closing delimiter
  for (let i = 2; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text.trim() === '---') {
      const from = firstLine.from;
      // Past the newline of the closing `---` line; clamp to doc.length
      const to = line.to < doc.length ? line.to + 1 : line.to;

      // YAML text sits between end of first line and start of closing line
      const yamlStart = firstLine.to + 1;
      const yamlEnd = line.from;
      const yamlText = yamlStart < yamlEnd ? doc.sliceString(yamlStart, yamlEnd) : '';

      return { from, to, yamlText };
    }
  }

  return null;
}

import { parse } from 'yaml';

/** Canonical data model for frontmatter fields, mirroring the Astro content schema */
export interface FrontmatterData {
  title: string;
  description: string;
  /** ISO date string or human-readable date */
  pubDate: string;
  updatedDate?: string;
  heroImage?: string;
  tags: string[];
  category?: string;
  series?: string;
  seriesOrder?: number;
  seriesTitle?: string;
}

/** Discriminated union for parse outcomes */
export type ParseResult =
  | { ok: true; data: FrontmatterData }
  | { ok: false; error: string };

/**
 * Parse a YAML string into a typed FrontmatterData object.
 * Returns { ok: false, error } when the input is not valid YAML
 * or does not represent a mapping structure.
 */
export function parseFrontmatter(yaml: string): ParseResult {
  try {
    const parsed = parse(yaml);

    // Must be a non-null object (YAML mapping)
    if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Frontmatter must be a YAML mapping' };
    }

    const data: FrontmatterData = {
      title: String(parsed.title ?? ''),
      description: String(parsed.description ?? ''),
      pubDate: String(parsed.pubDate ?? ''),
      updatedDate: parsed.updatedDate != null ? String(parsed.updatedDate) : undefined,
      heroImage: parsed.heroImage != null ? editorHeroImagePath(String(parsed.heroImage)) : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      category: parsed.category != null ? String(parsed.category) : undefined,
      series: parsed.series != null ? String(parsed.series) : undefined,
      seriesOrder: parsed.seriesOrder != null ? Number(parsed.seriesOrder) : undefined,
      seriesTitle: parsed.seriesTitle != null ? String(parsed.seriesTitle) : undefined,
    };

    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/** Ordered list of frontmatter fields for serialization */
const FIELD_ORDER: (keyof FrontmatterData)[] = [
  'title',
  'description',
  'pubDate',
  'updatedDate',
  'heroImage',
  'tags',
  'category',
  'series',
  'seriesOrder',
  'seriesTitle',
];

/** Optional fields that are omitted when empty or undefined */
const OPTIONAL_FIELDS = new Set<keyof FrontmatterData>([
  'updatedDate',
  'heroImage',
  'category',
  'series',
  'seriesOrder',
  'seriesTitle',
]);

/** Escape single quotes for YAML single-quoted scalar (double the quote) */
function escapeSQ(s: string): string {
  return s.replace(/'/g, "''");
}

/** Escape special characters for YAML double-quoted scalar */
function escapeDQ(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Convert editor-internal heroImage path to Astro-compatible relative path.
 * Editor uses `./assets/xxx` for global assets and `./xxx` for co-located images.
 * Astro needs `../../assets/images/xxx` for global assets (relative to post dir).
 * Co-located `./xxx` stays unchanged.
 */
function normalizeHeroImagePath(editorPath: string): string {
  if (editorPath.startsWith('./assets/')) {
    const name = editorPath.replace('./assets/', '');
    return `../../assets/images/${name}`;
  }
  return editorPath;
}

/**
 * Convert Astro-compatible heroImage path back to editor-internal format.
 * `../../assets/images/xxx` → `./assets/xxx`
 * `./xxx` (co-located) stays unchanged.
 */
export function editorHeroImagePath(astroPath: string): string {
  const match = astroPath.match(/^(?:\.\.\/)+assets\/images\/(.+)$/);
  if (match) return `./assets/${match[1]}`;
  return astroPath;
}

/**
 * Serialize a FrontmatterData object to YAML text wrapped in `---` delimiters.
 * Field order: title → description → pubDate → updatedDate → heroImage → tags → category.
 * String values use single quotes; tags use inline bracket notation with double-quoted elements.
 * Optional fields with empty/undefined values are omitted entirely.
 */
export function serializeFrontmatter(data: FrontmatterData): string {
  const lines: string[] = ['---'];

  for (const key of FIELD_ORDER) {
    let value = data[key];

    // Omit optional fields when empty or undefined
    if (OPTIONAL_FIELDS.has(key) && (value === undefined || value === '')) {
      continue;
    }

    if (key === 'heroImage' && typeof value === 'string') {
      value = normalizeHeroImagePath(value);
    }

    if (key === 'tags') {
      const tags = value as string[];
      const inner = tags.map((t) => `"${escapeDQ(String(t))}"`).join(', ');
      lines.push(`tags: [${inner}]`);
    } else if (key === 'seriesOrder') {
      // Numeric field — no quotes
      lines.push(`seriesOrder: ${Number(value)}`);
    } else {
      lines.push(`${key}: '${escapeSQ(String(value))}'`);
    }
  }

  lines.push('---');
  return lines.join('\n') + '\n';
}
