import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import type { Root } from 'mdast';
import { parseAttachmentReference } from './paths';
import { attachmentTokens, normalizeAttachmentSyntax, remarkAttachmentSyntax } from './syntax';
import type { AttachmentToken } from './syntax';

export interface AttachmentTextOptions {
  /** Use auto for sources that can contain either Markdown or MDX. */
  mdx?: boolean | 'auto';
  format?: (name: string, token: AttachmentToken) => string;
}

export interface PreparedAttachmentText {
  /** Markdown with active attachment tokens replaced by opaque placeholders. */
  source: string;
  /** Restore names after existing markup processing, without parsing names as markup. */
  restore: (text: string) => string;
}

const markdownParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkAttachmentSyntax);
const mdxParser = markdownParser().use(remarkMdx);

type ParseMode = 'markdown' | 'mdx' | 'auto';
interface TokenCacheEntry {
  markdown?: AttachmentToken[];
  mdx?: AttachmentToken[];
  auto?: AttachmentToken[];
}

const tokenCache = new Map<string, TokenCacheEntry>();
const TOKEN_CACHE_ENTRIES = 64;
const TOKEN_CACHE_SOURCE_CHARS = 2 * 1024 * 1024;
let tokenCacheSourceChars = 0;

function parseSource(source: string, mode: AttachmentTextOptions['mdx']): Root {
  if (!mode) return markdownParser.parse(source);
  try {
    return mdxParser.parse(source);
  } catch (error) {
    if (mode !== 'auto') throw error;
    return markdownParser.parse(source);
  }
}

function cachedAttachmentTokens(source: string, mode: AttachmentTextOptions['mdx']): AttachmentToken[] {
  const key: ParseMode = mode === 'auto' ? 'auto' : mode ? 'mdx' : 'markdown';
  const cached = tokenCache.get(source);
  const tokens = cached?.[key];
  if (tokens) {
    tokenCache.delete(source);
    tokenCache.set(source, cached!);
    return tokens;
  }

  const tree = parseSource(source, mode);
  normalizeAttachmentSyntax(tree);
  const parsed = attachmentTokens(tree);
  const entry = cached ?? {};
  entry[key] = parsed;
  if (cached) tokenCache.delete(source);
  else tokenCacheSourceChars += source.length;
  tokenCache.set(source, entry);
  while (tokenCache.size > TOKEN_CACHE_ENTRIES || tokenCacheSourceChars > TOKEN_CACHE_SOURCE_CHARS) {
    const oldest = tokenCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    tokenCache.delete(oldest);
    tokenCacheSourceChars -= oldest.length;
  }
  return parsed;
}

/**
 * Share authoring grammar with renderers while preserving the caller's code policy.
 * Files are never opened. Only active tokens are replaced; code, HTML and links stay literal.
 */
export function prepareAttachmentText(
  source: string,
  options: AttachmentTextOptions = {},
): PreparedAttachmentText {
  if (!source.includes(':attachment[')) return { source, restore: (text) => text };
  // Frontmatter is not Markdown content. Preserve offsets for the remaining source.
  const parseable = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (block) => block.replace(/[^\r\n]/g, ' '));
  const tokens = cachedAttachmentTokens(parseable, options.mdx);
  if (!tokens.length) return { source, restore: (text) => text };

  let prefix = '\uE000ATTACHMENT';
  while (source.includes(prefix)) prefix += 'X';
  const names: string[] = [];
  let previous = 0;
  let prepared = '';
  for (const token of tokens) {
    const start = token.position?.start.offset;
    const end = token.position?.end.offset;
    if (start === undefined || end === undefined) continue;
    const id = parseAttachmentReference(token.reference)!;
    const name = id.split('/').at(-1)!;
    prepared += source.slice(previous, start) + prefix + names.length + '\uE001';
    names.push(options.format ? options.format(name, token) : name);
    previous = end;
  }
  prepared += source.slice(previous);
  const placeholders = new RegExp(prefix + '(\\d+)\uE001', 'g');
  return {
    source: prepared,
    restore: (text) => text.replace(placeholders, (original, index: string) => names[Number(index)] ?? original),
  };
}

/** Replace active attachments with filenames, leaving all other source text intact. */
export function attachmentPlainText(source: string, options?: AttachmentTextOptions): string {
  const prepared = prepareAttachmentText(source, options);
  return prepared.restore(prepared.source);
}
