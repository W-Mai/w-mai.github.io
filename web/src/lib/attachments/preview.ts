import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { extname } from 'node:path';
import { attachmentFilePath } from './files';
import type { AttachmentInfo, AttachmentOptions } from './paths';

export const ATTACHMENT_PREVIEW_BYTE_LIMIT = 64 * 1024;
export const ATTACHMENT_PREVIEW_LINE_LIMIT = 400;
export const ATTACHMENT_PREVIEW_ROW_LIMIT = 80;
export const ATTACHMENT_PREVIEW_COLUMN_LIMIT = 24;
export const ATTACHMENT_PREVIEW_CELL_LIMIT = 4 * 1024;

export type AttachmentPreviewKind =
  | 'image'
  | 'text'
  | 'json'
  | 'table'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'binary';

export interface AttachmentPreview {
  kind: AttachmentPreviewKind;
  language?: string;
  text?: string;
  rows?: string[][];
  truncated?: boolean;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const JSON_EXTENSIONS = new Set(['.json', '.jsonl', '.ndjson']);
const TABLE_EXTENSIONS = new Set(['.csv', '.tsv']);
const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.css', '.h', '.hpp', '.html', '.js', '.jsx', '.log', '.lua',
  '.md', '.mdx', '.mjs', '.py', '.rn', '.rs', '.sh', '.toml', '.ts', '.tsx', '.txt',
  '.xml', '.yaml', '.yml',
]);
const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.c': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.css': 'css', '.h': 'c', '.hpp': 'cpp',
  '.html': 'html', '.js': 'javascript', '.jsx': 'jsx', '.json': 'json', '.jsonl': 'json',
  '.lua': 'lua', '.md': 'markdown', '.mdx': 'mdx', '.mjs': 'javascript', '.py': 'python',
  '.rn': 'rune', '.rs': 'rust', '.sh': 'shell', '.toml': 'toml', '.ts': 'typescript',
  '.tsx': 'tsx', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
};

/** Choose a renderer from trusted attachment metadata without inspecting active content. */
export function attachmentPreviewKind(attachment: AttachmentInfo): AttachmentPreviewKind {
  const extension = extname(attachment.id).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (extension === '.pdf' || attachment.mediaType === 'application/pdf') return 'pdf';
  if (attachment.mediaType.startsWith('audio/')) return 'audio';
  if (attachment.mediaType.startsWith('video/')) return 'video';
  if (JSON_EXTENSIONS.has(extension)) return 'json';
  if (TABLE_EXTENSIONS.has(extension)) return 'table';
  if (TEXT_EXTENSIONS.has(extension) || attachment.mediaType.startsWith('text/')) return 'text';
  return 'binary';
}

async function boundedText(attachment: AttachmentInfo, options: AttachmentOptions): Promise<{
  text: string;
  truncated: boolean;
}> {
  const path = await attachmentFilePath(attachment.id, options.directory);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`Attachment is not a regular file: ${attachment.id}`);
    const capacity = Math.min(stat.size, ATTACHMENT_PREVIEW_BYTE_LIMIT + 4);
    const bytes = new Uint8Array(capacity);
    const { bytesRead } = await handle.read(bytes, 0, capacity, 0);
    const byteTruncated = stat.size > ATTACHMENT_PREVIEW_BYTE_LIMIT;
    const length = Math.min(bytesRead, ATTACHMENT_PREVIEW_BYTE_LIMIT);
    const decoder = new TextDecoder('utf-8');
    let text = decoder.decode(bytes.subarray(0, length), { stream: byteTruncated });
    if (!byteTruncated) text += decoder.decode();
    if (text.includes('\0')) return { text: '', truncated: true };

    const lines = text.split(/\r\n?|\n/);
    if (lines.length > ATTACHMENT_PREVIEW_LINE_LIMIT) {
      return {
        text: lines.slice(0, ATTACHMENT_PREVIEW_LINE_LIMIT).join('\n'),
        truncated: true,
      };
    }
    return { text, truncated: byteTruncated };
  } finally {
    await handle.close();
  }
}

function boundedGeneratedText(value: string): { text: string; truncated: boolean } {
  const bytes = new TextEncoder().encode(value);
  let text = value;
  let truncated = false;
  if (bytes.byteLength > ATTACHMENT_PREVIEW_BYTE_LIMIT) {
    text = new TextDecoder('utf-8').decode(bytes.subarray(0, ATTACHMENT_PREVIEW_BYTE_LIMIT), {
      stream: true,
    });
    truncated = true;
  }
  const lines = text.split(/\r\n?|\n/);
  if (lines.length > ATTACHMENT_PREVIEW_LINE_LIMIT) {
    text = lines.slice(0, ATTACHMENT_PREVIEW_LINE_LIMIT).join('\n');
    truncated = true;
  }
  return { text, truncated };
}

function pushCell(row: string[], cell: string, state: { truncated: boolean }): void {
  if (row.length >= ATTACHMENT_PREVIEW_COLUMN_LIMIT) {
    state.truncated = true;
    return;
  }
  if (cell.length > ATTACHMENT_PREVIEW_CELL_LIMIT) {
    row.push(cell.slice(0, ATTACHMENT_PREVIEW_CELL_LIMIT));
    state.truncated = true;
  } else {
    row.push(cell);
  }
}

/** Parse enough RFC 4180-style data for a bounded preview; malformed quoting falls back to text. */
export function parseDelimitedPreview(text: string, delimiter: ',' | '\t'): {
  rows: string[][];
  truncated: boolean;
} | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let afterQuote = false;
  const state = { truncated: false };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          if (cell.length < ATTACHMENT_PREVIEW_CELL_LIMIT) cell += '"';
          else state.truncated = true;
          index++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else if (cell.length < ATTACHMENT_PREVIEW_CELL_LIMIT) {
        cell += character;
      } else {
        state.truncated = true;
      }
      continue;
    }

    if (character === '"' && cell === '' && !afterQuote) {
      quoted = true;
      continue;
    }
    if (character === delimiter) {
      pushCell(row, cell, state);
      cell = '';
      afterQuote = false;
      continue;
    }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      pushCell(row, cell, state);
      cell = '';
      afterQuote = false;
      if (rows.length < ATTACHMENT_PREVIEW_ROW_LIMIT) rows.push(row);
      else state.truncated = true;
      row = [];
      if (rows.length >= ATTACHMENT_PREVIEW_ROW_LIMIT && index < text.length - 1) {
        state.truncated = true;
        break;
      }
      continue;
    }
    if (afterQuote) return null;
    if (cell.length < ATTACHMENT_PREVIEW_CELL_LIMIT) cell += character;
    else state.truncated = true;
  }

  if (quoted) return null;
  if (cell || row.length) {
    pushCell(row, cell, state);
    if (rows.length < ATTACHMENT_PREVIEW_ROW_LIMIT) rows.push(row);
    else state.truncated = true;
  }
  return { rows, truncated: state.truncated };
}

/** Read only the bounded text needed by a static card. Media and binary previews never read bytes. */
export async function loadAttachmentPreview(
  attachment: AttachmentInfo,
  options: AttachmentOptions,
): Promise<AttachmentPreview> {
  const kind = attachmentPreviewKind(attachment);
  if (!['text', 'json', 'table'].includes(kind)) return { kind };

  const bounded = await boundedText(attachment, options);
  if (bounded.text === '' && attachment.size > 0) return { kind: 'binary' };
  const extension = extname(attachment.id).toLowerCase();
  if (kind === 'json' && !bounded.truncated && extension === '.json') {
    try {
      const formatted = boundedGeneratedText(JSON.stringify(JSON.parse(bounded.text), null, 2));
      return {
        kind,
        language: 'json',
        ...formatted,
      };
    } catch {
      return { kind: 'text', language: 'json', ...bounded };
    }
  }
  if (kind === 'table') {
    const table = parseDelimitedPreview(bounded.text, extension === '.tsv' ? '\t' : ',');
    if (table) return { kind, rows: table.rows, truncated: bounded.truncated || table.truncated };
    return { kind: 'text', language: extension.slice(1), ...bounded };
  }
  return {
    kind,
    language: LANGUAGE_BY_EXTENSION[extension] ?? (extension.slice(1) || undefined),
    ...bounded,
  };
}
