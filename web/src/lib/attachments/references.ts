import { lstat, readdir, readFile } from 'node:fs/promises';
import { extname, isAbsolute, join } from 'node:path';
import type { Definition, Root } from 'mdast';
import type { Point } from 'unist';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import { VFile } from 'vfile';
import { isScalar, LineCounter, parseDocument } from 'yaml';
import { attachmentUrl, parseAttachmentReference, validateAttachmentId } from './paths';
import type { AttachmentOptions } from './paths';

export interface AttachmentReferenceDirectories {
  postsDirectory: string;
  thoughtsDirectory?: string;
}

export interface AttachmentReference {
  /** Public content path, independent of the machine's checkout location. */
  path: string;
  /** Source location; folded or escaped YAML strings point to their content scalar. */
  line: number;
  column: number;
  reference: string;
  /** Markdown line inside a YAML content value, when applicable. */
  contentLine?: number;
}

export class AttachmentReferenceScanError extends Error {
  readonly status = 409;

  constructor(path: string, reason: string, line = 1, column = 1) {
    super(`Cannot check attachment references in ${path}:${line}:${column}: ${reason}`);
    this.name = 'AttachmentReferenceScanError';
  }
}

interface SourceFile {
  absolute: string;
  path: string;
  id: string;
}

async function sourceFiles(directory: string, prefix: string, extensions: Set<string>): Promise<SourceFile[]> {
  if (!isAbsolute(directory)) throw new AttachmentReferenceScanError(prefix, 'Source directory must be absolute.');
  const files: SourceFile[] = [];
  async function walk(absolute: string, id: string, initial = false): Promise<void> {
    const path = id ? `${prefix}/${id}` : prefix;
    try {
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new AttachmentReferenceScanError(path, 'Symbolic links cannot be scanned.');
      if (initial && !info.isDirectory()) throw new AttachmentReferenceScanError(path, 'Source root must be a directory.');
      if (info.isDirectory()) {
        const entries = await readdir(absolute);
        for (const name of entries.sort()) {
          if (name.startsWith('.')) continue;
          await walk(join(absolute, name), id ? `${id}/${name}` : name);
        }
      } else if (info.isFile()) {
        if (extensions.has(extname(id).toLowerCase())) files.push({ absolute, path, id });
      } else {
        throw new AttachmentReferenceScanError(path, 'Source is not a regular file or directory.');
      }
    } catch (error) {
      if (error instanceof AttachmentReferenceScanError) throw error;
      const code = (error as NodeJS.ErrnoException).code;
      if (initial && code === 'ENOENT') return;
      throw new AttachmentReferenceScanError(path, `Cannot read source${code ? ` (${code})` : ''}.`);
    }
  }
  await walk(directory, '', true);
  return files;
}

async function sourceText(source: SourceFile): Promise<string> {
  try {
    return await readFile(source.absolute, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new AttachmentReferenceScanError(source.path, `Cannot read source${code ? ` (${code})` : ''}.`);
  }
}

function withoutFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (block) =>
    block.replace(/[^\r\n]/g, ' '),
  );
}

function referencedId(reference: string, options: AttachmentOptions, sourceId?: string): string | null {
  if (reference.startsWith('#')) return null;
  if (reference.startsWith('attachment:')) return parseAttachmentReference(reference);
  const absoluteUrl = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference);
  if (!sourceId && !reference.startsWith('/') && !absoluteUrl) return null;
  if (absoluteUrl && !options.site) return null;
  const origin = options.site ? new URL(options.site).origin : 'https://attachments.invalid';
  const base = sourceId ? new URL(attachmentUrl(sourceId, options.base), origin) : origin;
  let url: URL;
  try { url = new URL(reference, base); } catch { return null; }
  if (url.origin !== origin) return null;
  const mount = attachmentUrl('placeholder', options.base).slice(0, -'placeholder'.length);
  if (!url.pathname.startsWith(mount)) return null;
  return parseAttachmentReference(`attachment:${url.pathname.slice(mount.length)}`);
}

type LocatedPoint = Pick<AttachmentReference, 'line' | 'column' | 'contentLine'>;
type Locate = (point: Point) => LocatedPoint;

function markdownReferences(
  content: string,
  source: SourceFile,
  target: string,
  options: AttachmentOptions,
  settings: { mdx?: boolean; attachmentId?: string; locate?: Locate } = {},
): AttachmentReference[] {
  const locate: Locate = settings.locate ?? ((point) => ({ line: point.line, column: point.column }));
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  if (settings.mdx) processor.use(remarkMdx);
  let tree: Root;
  try {
    tree = processor.parse(new VFile({ path: source.path, value: content })) as Root;
  } catch (error) {
    const detail = error as { reason?: string; line?: number; column?: number };
    const location = locate({ line: detail.line ?? 1, column: detail.column ?? 1 });
    throw new AttachmentReferenceScanError(source.path, detail.reason ?? 'Invalid Markdown syntax.', location.line, location.column);
  }
  const definitions = new Map<string, Definition>();
  visit(tree, 'definition', (node) => {
    const key = node.identifier.toUpperCase();
    if (!definitions.has(key)) definitions.set(key, node);
  });
  const references: AttachmentReference[] = [];
  visit(tree, (node) => {
    let reference: string | undefined;
    if (node.type === 'link' || node.type === 'image') reference = node.url;
    else if (node.type === 'linkReference' || node.type === 'imageReference') {
      reference = definitions.get(node.identifier.toUpperCase())?.url;
    }
    if (reference === undefined) return;
    const location = locate(node.position?.start ?? { line: 1, column: 1 });
    let id: string | null;
    try {
      id = referencedId(reference, options, settings.attachmentId);
    } catch {
      throw new AttachmentReferenceScanError(source.path, 'Invalid attachment link.', location.line, location.column);
    }
    if (id === target) references.push({ path: source.path, ...location, reference });
  });
  return references;
}

function yamlReferences(raw: string, source: SourceFile, target: string, options: AttachmentOptions): AttachmentReference[] {
  const counter = new LineCounter();
  const document = parseDocument(raw, { keepSourceTokens: true, lineCounter: counter });
  if (document.errors.length) {
    const error = document.errors[0];
    const location = error.linePos?.[0] ?? { line: 1, col: 1 };
    throw new AttachmentReferenceScanError(source.path, 'Invalid YAML syntax.', location.line, location.col);
  }
  const scalar = document.get('content', true);
  if (scalar === undefined) return [];
  if (!isScalar(scalar) || typeof scalar.value !== 'string') {
    throw new AttachmentReferenceScanError(source.path, 'The content field must be a string.');
  }
  const token = scalar.srcToken;
  const scalarOffset = scalar.range?.[0] ?? 0;
  const locate: Locate = (point) => {
    let offset = scalarOffset;
    if (token?.type === 'block-scalar' && token.props.some((part) =>
      part.type === 'block-scalar-header' && 'source' in part && part.source.startsWith('|'))) {
      const end = token.props.at(-1);
      const start = end && 'source' in end ? end.offset + end.source.length : token.offset;
      const lines = token.source.split('\n');
      const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)![0].length));
      offset = start + lines.slice(0, point.line - 1).reduce((sum, line) => sum + line.length + 1, 0)
        + (Number.isFinite(indent) ? indent : 0) + point.column - 1;
    } else if (token && 'source' in token) {
      const plain = token.source === scalar.value;
      const quoted = token.source.slice(1, -1) === scalar.value;
      if (plain || quoted) offset = token.offset + (quoted ? 1 : 0) + (point.offset ?? 0);
    }
    const location = counter.linePos(offset);
    return { line: location.line, column: location.col, contentLine: point.line };
  };
  return markdownReferences(scalar.value, source, target, options, { locate });
}

/**
 * Find static Markdown links and images before changing an attachment identifier.
 * Reads every content source; code examples and unused definitions are excluded.
 * Runtime JavaScript expressions and dynamically generated URLs are outside this analysis.
 * A failed scan throws status 409 so a caller cannot treat incomplete results as no references.
 */
export async function findAttachmentReferences(
  id: string,
  options: AttachmentOptions,
  directories: AttachmentReferenceDirectories,
): Promise<AttachmentReference[]> {
  validateAttachmentId(id);
  attachmentUrl(id, options.base);
  const references: AttachmentReference[] = [];
  const posts = await sourceFiles(directories.postsDirectory, 'posts', new Set(['.md', '.mdx']));
  for (const source of posts) {
    references.push(...markdownReferences(withoutFrontmatter(await sourceText(source)), source, id, options, {
      mdx: extname(source.id).toLowerCase() === '.mdx',
    }));
  }
  if (directories.thoughtsDirectory) {
    const thoughts = await sourceFiles(directories.thoughtsDirectory, 'thoughts', new Set(['.yaml', '.yml']));
    for (const source of thoughts) references.push(...yamlReferences(await sourceText(source), source, id, options));
  }
  const attachments = await sourceFiles(options.directory, 'attachments', new Set(['.md', '.markdown']));
  for (const source of attachments) {
    references.push(...markdownReferences(withoutFrontmatter(await sourceText(source)), source, id, options, {
      attachmentId: source.id,
    }));
  }
  return references;
}
