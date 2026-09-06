import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ATTACHMENT_PREVIEW_BYTE_LIMIT,
  ATTACHMENT_PREVIEW_CELL_LIMIT,
  ATTACHMENT_PREVIEW_COLUMN_LIMIT,
  ATTACHMENT_PREVIEW_LINE_LIMIT,
  ATTACHMENT_PREVIEW_ROW_LIMIT,
  attachmentPreviewKind,
  loadAttachmentPreview,
  parseDelimitedPreview,
} from '../preview';
import type { AttachmentInfo } from '../paths';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function info(id: string, mediaType: string, size = 1): AttachmentInfo {
  const name = id.slice(id.lastIndexOf('/') + 1);
  return { id, name, mediaType, size, reference: `attachment:${id}`, url: `/downloads/${id}` };
}

async function fixture(id: string, content: string | Uint8Array, mediaType: string): Promise<{
  attachment: AttachmentInfo;
  directory: string;
}> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'attachment-preview-')));
  roots.push(directory);
  const path = join(directory, id);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content);
  return { attachment: info(id, mediaType, Buffer.byteLength(content)), directory };
}

describe('attachment preview selection', () => {
  it('uses explicit safe renderers and leaves active or unknown binaries inert', () => {
    expect(attachmentPreviewKind(info('image.svg', 'image/svg+xml'))).toBe('image');
    expect(attachmentPreviewKind(info('report.pdf', 'application/pdf'))).toBe('pdf');
    expect(attachmentPreviewKind(info('sound.mp3', 'audio/mpeg'))).toBe('audio');
    expect(attachmentPreviewKind(info('movie.mp4', 'video/mp4'))).toBe('video');
    expect(attachmentPreviewKind(info('page.html', 'text/html'))).toBe('text');
    expect(attachmentPreviewKind(info('module.wasm', 'application/wasm'))).toBe('binary');
  });
});

describe('bounded attachment previews', () => {
  it('formats complete JSON and falls back to source for invalid JSON', async () => {
    const valid = await fixture('data.json', '{"value":1}', 'application/json');
    const invalid = await fixture('bad.json', '{broken', 'application/json');
    expect(await loadAttachmentPreview(valid.attachment, valid)).toMatchObject({
      kind: 'json', language: 'json', text: '{\n  "value": 1\n}',
    });
    expect(await loadAttachmentPreview(invalid.attachment, invalid)).toMatchObject({
      kind: 'text', language: 'json', text: '{broken', truncated: false,
    });
  });

  it('parses quoted CSV cells and rejects characters after a closing quote', () => {
    expect(parseDelimitedPreview('name,note\nA,"one, two"\nB,"say ""hi"""', ',')).toEqual({
      rows: [['name', 'note'], ['A', 'one, two'], ['B', 'say "hi"']],
      truncated: false,
    });
    expect(parseDelimitedPreview('a\n"b"oops', ',')).toBeNull();
  });

  it('bounds table rows, columns, and individual cells', () => {
    const cell = parseDelimitedPreview('x'.repeat(ATTACHMENT_PREVIEW_CELL_LIMIT + 1), ',')!;
    expect(cell.rows[0][0]).toHaveLength(ATTACHMENT_PREVIEW_CELL_LIMIT);
    expect(cell.truncated).toBe(true);

    const columns = parseDelimitedPreview(
      Array.from({ length: ATTACHMENT_PREVIEW_COLUMN_LIMIT + 2 }, () => 'x').join(','),
      ',',
    )!;
    expect(columns.rows[0]).toHaveLength(ATTACHMENT_PREVIEW_COLUMN_LIMIT);
    expect(columns.truncated).toBe(true);

    const rows = parseDelimitedPreview(
      Array.from({ length: ATTACHMENT_PREVIEW_ROW_LIMIT + 2 }, () => 'x').join('\n'),
      ',',
    )!;
    expect(rows.rows).toHaveLength(ATTACHMENT_PREVIEW_ROW_LIMIT);
    expect(rows.truncated).toBe(true);
  });

  it('caps text bytes and reports truncation without reading active HTML', async () => {
    const item = await fixture('page.html', 'x'.repeat(ATTACHMENT_PREVIEW_BYTE_LIMIT + 20), 'text/html');
    const preview = await loadAttachmentPreview(item.attachment, item);
    expect(preview.kind).toBe('text');
    expect(preview.text).toHaveLength(ATTACHMENT_PREVIEW_BYTE_LIMIT);
    expect(preview.truncated).toBe(true);
  });

  it('reapplies byte and line limits after formatting compact JSON', async () => {
    const source = JSON.stringify(Array.from({ length: 20_000 }, (_, index) => index % 10));
    const item = await fixture('large.json', source, 'application/json');
    const preview = await loadAttachmentPreview(item.attachment, item);
    expect(preview.kind).toBe('json');
    expect(preview.truncated).toBe(true);
    if (preview.text === undefined) throw new Error('Expected a JSON text preview');
    expect(new TextEncoder().encode(preview.text).byteLength).toBeLessThanOrEqual(ATTACHMENT_PREVIEW_BYTE_LIMIT);
    expect(preview.text.split('\n')).toHaveLength(ATTACHMENT_PREVIEW_LINE_LIMIT);
  });

  it('counts lone carriage returns toward the text line limit', async () => {
    const item = await fixture('legacy.txt', `line\r`.repeat(ATTACHMENT_PREVIEW_LINE_LIMIT + 1), 'text/plain');
    const preview = await loadAttachmentPreview(item.attachment, item);
    expect(preview.kind).toBe('text');
    expect(preview.truncated).toBe(true);
    if (preview.text === undefined) throw new Error('Expected a text preview');
    expect(preview.text.split('\n')).toHaveLength(ATTACHMENT_PREVIEW_LINE_LIMIT);
  });

  it('treats NUL-containing nominal text as binary', async () => {
    const item = await fixture('data.txt', new Uint8Array([65, 0, 66]), 'text/plain');
    expect(await loadAttachmentPreview(item.attachment, item)).toEqual({ kind: 'binary' });
  });
});
