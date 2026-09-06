import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  attachmentReference,
  attachmentUrl,
  formatAttachmentSize,
  parseAttachmentReference,
  validateAttachmentId,
} from '../paths';
import type { AttachmentOptions } from '../paths';
import {
  attachmentFilePath,
  listAttachments,
  MAX_ATTACHMENT_UPLOAD_BYTES,
  resolveAttachment,
  storeAttachment,
} from '../files';

function stream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe('attachment path contract', () => {
  it('round-trips decoded IDs through one canonical Markdown-safe encoding', () => {
    const characters = fc.constantFrom('a', '中', '文', ' ', '%', '(', ')', '[', ']', '!', "'", '*', '?', '#', '🦀');
    const segment = fc.array(characters, { minLength: 1, maxLength: 20 }).map((parts) => parts.join(''));
    fc.assert(fc.property(fc.array(segment, { minLength: 1, maxLength: 5 }), (parts) => {
      const id = parts.join('/');
      const reference = attachmentReference(id);
      expect(parseAttachmentReference(reference)).toBe(id);
      expect(reference).not.toMatch(/[\s!'()*\[\]?#]/u);
      expect(attachmentUrl(id, '/notes/')).toBe(`/notes/downloads/${reference.slice('attachment:'.length)}`);
    }), { numRuns: 200 });
  });

  it('encodes punctuation and literal percent signs without a second decode', () => {
    const id = '数据 文件/bench (1) [raw] 100%!.rs';
    expect(attachmentReference(id)).toBe('attachment:%E6%95%B0%E6%8D%AE%20%E6%96%87%E4%BB%B6/bench%20%281%29%20%5Braw%5D%20100%25%21.rs');
    expect(parseAttachmentReference('attachment:group/%252e%252e')).toBe('group/%2e%2e');
    expect(parseAttachmentReference('attachment:group/literal%252f.csv')).toBe('group/literal%2f.csv');
    expect(validateAttachmentId('group/100%.csv')).toBe('group/100%.csv');
    expect(parseAttachmentReference('https://example.com/a.csv')).toBeNull();
    expect(parseAttachmentReference('/downloads/a.csv')).toBeNull();
  });

  it.each([
    '', '/etc/passwd', '//host/file', 'C:/file', 'C:file', 'group//file', 'group/',
    '../file', 'group/../file', './file', 'group/.private/file', '.git/config',
    'group\\file', 'group/a\u0000b', 'group/a\nb', 'group/a\u007fb', 'group/\ud800',
  ])('rejects invalid decoded ID %j', (id) => {
    expect(() => validateAttachmentId(id)).toThrow();
  });

  it.each([
    'attachment:', 'attachment:/file', 'attachment:group/%2fetc', 'attachment:group/%5cfile',
    'attachment:group/%2e%2e/file', 'attachment:group/%2eprivate/file',
    'attachment:group/%00file', 'attachment:group/%', 'attachment:group/%ZZ',
  ])('rejects malformed or escaping reference %j', (reference) => {
    expect(() => parseAttachmentReference(reference)).toThrow();
  });

  it('builds root and nested-base URLs with one separator', () => {
    expect(attachmentUrl('group/data.csv')).toBe('/downloads/group/data.csv');
    expect(attachmentUrl('group/data.csv', '/notes')).toBe('/notes/downloads/group/data.csv');
    expect(attachmentUrl('group/data.csv', '/notes/')).toBe('/notes/downloads/group/data.csv');
    expect(() => attachmentUrl('group/data.csv', 'https://example.com')).toThrow();
    expect(() => attachmentUrl('group/data.csv', '/a/../b')).toThrow();
  });

  it('formats integer byte counts using binary units', () => {
    expect(formatAttachmentSize(0)).toBe('0 B');
    expect(formatAttachmentSize(1023)).toBe('1023 B');
    expect(formatAttachmentSize(1024)).toBe('1 KiB');
    expect(formatAttachmentSize(1536)).toBe('1.5 KiB');
    expect(formatAttachmentSize(MAX_ATTACHMENT_UPLOAD_BYTES)).toBe('32 MiB');
    expect(() => formatAttachmentSize(-1)).toThrow();
    expect(() => formatAttachmentSize(NaN)).toThrow();
  });
});

describe('attachment filesystem contract', () => {
  let fixture: string;
  let options: AttachmentOptions;

  beforeEach(async () => {
    fixture = await mkdtemp(join(await realpath(tmpdir()), 'attachment-'));
    options = { directory: join(fixture, 'attachments'), base: '/notes/' };
  });

  afterEach(async () => {
    await rm(fixture, { recursive: true, force: true });
  });

  async function put(id: string, bytes: string | Uint8Array): Promise<string> {
    const path = join(options.directory, id);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    return path;
  }

  it('treats a missing root as empty but a missing reference as an error', async () => {
    expect(await listAttachments(options)).toEqual([]);
    await expect(lstat(options.directory)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(resolveAttachment('attachment:missing.csv', options)).rejects.toMatchObject({ status: 404 });
    await expect(resolveAttachment('https://example.com/a.csv', options)).rejects.toMatchObject({ status: 400 });
    await expect(listAttachments({ directory: 'attachments' })).rejects.toMatchObject({ status: 400 });
  });

  it('enumerates every regular attachment, ignores hidden entries, and exposes only public metadata', async () => {
    await put('group/README.md', '# data\r\n');
    await put('group/algorithms/bench.rn', 'pub fn main() { 42 }');
    await put('group/data.CSV', 'a,b\r\n1,2\r\n');
    await put('group/data.unknown', new Uint8Array([0, 255, 13, 10]));
    await put('.DS_Store', 'hidden');
    await put('group/.cache/private.json', '{}');
    const attachments = await listAttachments(options);
    expect(attachments.map((item) => item.id)).toEqual([
      'group/README.md', 'group/algorithms/bench.rn', 'group/data.CSV', 'group/data.unknown',
    ]);
    expect(attachments.map((item) => item.mediaType)).toEqual([
      'text/markdown', 'text/plain', 'text/csv', 'application/octet-stream',
    ]);
    for (const item of attachments) {
      expect(Object.keys(item).sort()).toEqual(['id', 'mediaType', 'name', 'reference', 'size', 'url']);
      expect(JSON.stringify(item)).not.toContain(fixture);
      expect(await resolveAttachment(item.reference, options)).toEqual(item);
      expect(item.size).toBe((await readFile(await attachmentFilePath(item.id, options.directory))).byteLength);
    }
    await expect(attachmentFilePath('group/.cache/private.json', options.directory)).rejects.toMatchObject({ status: 400 });
  });

  it('preserves exact source bytes and nested IDs when copied into an output tree', async () => {
    const bytes = new Uint8Array([0x1f, 0x8b, 0, 255, 13, 10, 0, 128]);
    await put('数据 [原始]/100% (1).gz', bytes);
    await put('group/literal%2f.csv', 'literal percent escape');
    const attachments = await listAttachments(options);
    for (const info of attachments) {
      const source = await attachmentFilePath(info.id, options.directory);
      const output = join(fixture, 'dist', 'downloads', info.id);
      await mkdir(dirname(output), { recursive: true });
      await copyFile(source, output);
      expect(await readFile(output)).toEqual(await readFile(source));
      expect(await resolveAttachment(info.reference, options)).toEqual(info);
    }
    expect(attachments.find((item) => item.id.endsWith('.gz'))?.mediaType).toBe('application/gzip');
  });

  it('rejects absolute, parent, hidden, and encoded separator access', async () => {
    await put('group/known.txt', 'known');
    for (const id of ['../outside.txt', '/etc/passwd', 'group/../../outside.txt', 'group/.secret']) {
      await expect(attachmentFilePath(id, options.directory)).rejects.toMatchObject({ status: 400 });
    }
    await expect(resolveAttachment('attachment:group/%2e%2e/outside.txt', options)).rejects.toMatchObject({ status: 400 });
    await expect(resolveAttachment('attachment:group%2fknown.txt', options)).rejects.toMatchObject({ status: 400 });
    await expect(attachmentFilePath('group', options.directory)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects symbolic links at the root, inside directories, and at file leaves', async () => {
    const outside = join(fixture, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'secret.txt'), 'outside');
    await symlink(outside, options.directory);
    await expect(listAttachments(options)).rejects.toMatchObject({ status: 400 });
    await expect(attachmentFilePath('secret.txt', options.directory)).rejects.toMatchObject({ status: 400 });
    await rm(options.directory);
    await mkdir(options.directory);
    await symlink(outside, join(options.directory, 'linked'));
    await expect(listAttachments(options)).rejects.toMatchObject({ status: 400 });
    await expect(attachmentFilePath('linked/secret.txt', options.directory)).rejects.toMatchObject({ status: 400 });
    await rm(join(options.directory, 'linked'));
    await symlink(join(outside, 'secret.txt'), join(options.directory, 'file.txt'));
    await expect(attachmentFilePath('file.txt', options.directory)).rejects.toMatchObject({ status: 400 });
    await expect(listAttachments(options)).rejects.toMatchObject({ status: 400 });
    expect(await readFile(join(outside, 'secret.txt'), 'utf8')).toBe('outside');
  });

  it('rejects non-regular filesystem entries without attempting to read them', async () => {
    await mkdir(options.directory);
    const server = createServer();
    const socketPath = join(options.directory, 'socket');
    await new Promise<void>((resolveReady, reject) => {
      server.once('error', reject);
      server.listen(socketPath, resolveReady);
    });
    try {
      await expect(listAttachments(options)).rejects.toMatchObject({ status: 400 });
      await expect(attachmentFilePath('socket', options.directory)).rejects.toMatchObject({ status: 400 });
    } finally {
      await new Promise<void>((resolveClosed, reject) => server.close((error) => error ? reject(error) : resolveClosed()));
    }
  });

  it('uploads binary streams unchanged into safely created groups', async () => {
    const bytes = new Uint8Array([0, 13, 10, 255, 128, 0x1f, 0x8b]);
    const info = await storeAttachment('实验 数据/nested', '结果 (1) [100%].zip', stream([
      bytes.subarray(0, 2), new Uint8Array(), bytes.subarray(2),
    ]), options);
    expect(info.id).toBe('实验 数据/nested/结果 (1) [100%].zip');
    expect(info.size).toBe(bytes.byteLength);
    expect(info.mediaType).toBe('application/zip');
    expect(new Uint8Array(await readFile(await attachmentFilePath(info.id, options.directory)))).toEqual(bytes);
    expect(await resolveAttachment(info.reference, options)).toEqual(info);
  });

  it('exclusively creates distinct names under concurrent duplicate uploads', async () => {
    const original = await put('group/report.csv', 'original');
    const outputs = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      storeAttachment('group', 'report.csv', stream([new TextEncoder().encode(String(index))]), options),
    ));
    expect(new Set(outputs.map((item) => item.id)).size).toBe(8);
    expect(outputs.map((item) => item.id).sort()).toEqual(Array.from({ length: 8 }, (_, index) => `group/report (${index + 1}).csv`));
    expect(await readFile(original, 'utf8')).toBe('original');
    for (const [index, info] of outputs.entries()) {
      expect(await readFile(await attachmentFilePath(info.id, options.directory), 'utf8')).toBe(String(index));
    }
    expect((await readdir(join(options.directory, 'group'))).filter((name) => name.startsWith('.'))).toEqual([]);
  });

  it('keeps a blocked upload invisible until complete without changing the existing file', async () => {
    const original = await put('group/report.bin', 'original');
    let release!: () => void;
    let signalBlocked!: () => void;
    const gate = new Promise<void>((resolveGate) => { release = resolveGate; });
    const blocked = new Promise<void>((resolveBlocked) => { signalBlocked = resolveBlocked; });
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (pulls++ === 0) {
          controller.enqueue(new Uint8Array([0, 255, 13]));
          return;
        }
        signalBlocked();
        await gate;
        controller.enqueue(new Uint8Array([10, 128]));
        controller.close();
      },
    }, { highWaterMark: 0 });
    const uploading = storeAttachment('group', 'report.bin', body, options);
    await blocked;
    let info;
    try {
      expect((await listAttachments(options)).map((item) => item.id)).toEqual(['group/report.bin']);
      expect(await readFile(original, 'utf8')).toBe('original');
      await expect(attachmentFilePath('group/report (1).bin', options.directory)).rejects.toMatchObject({ status: 404 });
      const hidden = (await readdir(join(options.directory, 'group'))).filter((name) => name.startsWith('.'));
      expect(hidden).toHaveLength(1);
      await expect(resolveAttachment(`attachment:group/${hidden[0]}`, options)).rejects.toMatchObject({ status: 400 });
    } finally {
      release();
      info = await uploading;
    }
    expect(info.id).toBe('group/report (1).bin');
    expect(info.size).toBe(5);
    expect(new Uint8Array(await readFile(await attachmentFilePath(info.id, options.directory))))
      .toEqual(new Uint8Array([0, 255, 13, 10, 128]));
    expect(await readFile(original, 'utf8')).toBe('original');
    expect((await readdir(join(options.directory, 'group'))).sort()).toEqual(['report (1).bin', 'report.bin']);
  });

  it('rejects unsafe upload names and linked parents without creating outside files', async () => {
    await expect(storeAttachment('../outside', 'data.txt', stream([]), options)).rejects.toMatchObject({ status: 400 });
    await expect(storeAttachment('group', '../data.txt', stream([]), options)).rejects.toMatchObject({ status: 400 });
    await expect(storeAttachment('group', 'nested/data.txt', stream([]), options)).rejects.toMatchObject({ status: 400 });
    const outside = join(fixture, 'outside');
    await mkdir(outside);
    await symlink(outside, join(fixture, 'alias'));
    const linkedOptions = { directory: join(fixture, 'alias', 'missing-root') };
    await expect(storeAttachment('group', 'data.txt', stream([]), linkedOptions)).rejects.toMatchObject({ status: 400 });
    await expect(lstat(join(outside, 'missing-root'))).rejects.toMatchObject({ code: 'ENOENT' });
    await mkdir(options.directory);
    await symlink(outside, join(options.directory, 'linked'));
    await expect(storeAttachment('linked', 'data.txt', stream([]), options)).rejects.toMatchObject({ status: 400 });
    await expect(lstat(join(outside, 'data.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a symbolic upload target instead of writing through it', async () => {
    const original = join(fixture, 'outside.txt');
    await writeFile(original, 'original');
    await mkdir(join(options.directory, 'group'), { recursive: true });
    await symlink(original, join(options.directory, 'group', 'data.txt'));
    await expect(storeAttachment('group', 'data.txt', stream([new Uint8Array([1])]), options)).rejects.toMatchObject({ status: 400 });
    expect(await readFile(original, 'utf8')).toBe('original');
    await expect(lstat(join(options.directory, 'group', 'data (1).txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(join(options.directory, 'group'))).toEqual(['data.txt']);
  });

  it('accepts the exact upload limit and rejects excess bytes counted across chunks', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    const exact = await storeAttachment('group', 'exact.bin', stream(Array(32).fill(chunk)), options);
    expect(exact.size).toBe(MAX_ATTACHMENT_UPLOAD_BYTES);
    let cancelled = false;
    let emitted = 0;
    const oversized = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (emitted++ < 33) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    await expect(storeAttachment('group', 'oversized.bin', oversized, options)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
    await expect(lstat(join(options.directory, 'group', 'oversized.bin'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await listAttachments(options)).map((item) => item.id)).toEqual(['group/exact.bin']);
    expect(await readdir(join(options.directory, 'group'))).toEqual(['exact.bin']);
  });

  it('removes an incomplete upload when its source stream fails', async () => {
    let pulls = 0;
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(new Uint8Array([0, 255, 10]));
        else controller.error(new Error('interrupted source'));
      },
    }, { highWaterMark: 0 });
    await expect(storeAttachment('group', 'broken.bin', broken, options)).rejects.toThrow('interrupted source');
    expect(await listAttachments(options)).toEqual([]);
    expect(await readdir(join(options.directory, 'group'))).toEqual([]);
  });

  it('does not impose the editor upload limit on existing files', async () => {
    const path = await put('group/large.bin', new Uint8Array());
    const { open } = await import('node:fs/promises');
    const file = await open(path, 'r+');
    await file.truncate(MAX_ATTACHMENT_UPLOAD_BYTES + 1);
    await file.close();
    expect((await resolveAttachment('attachment:group/large.bin', options)).size).toBe(MAX_ATTACHMENT_UPLOAD_BYTES + 1);
  });
});
