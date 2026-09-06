import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AttachmentOptions } from '../paths';
import {
  deleteAttachment, listAttachments, MAX_ATTACHMENT_UPLOAD_BYTES, renameAttachment,
  replaceAttachment, resolveAttachment, storeAttachment,
} from '../files';

function body(value: string | Uint8Array): ReadableStream<Uint8Array> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

describe('attachment scope and mutation invariants', () => {
  let root: string;
  let options: AttachmentOptions;
  let post: AttachmentOptions;

  beforeEach(async () => {
    root = await mkdtemp(join(await realpath(tmpdir()), 'attachment-scope-'));
    options = { directory: join(root, 'attachments'), base: '/notes/' };
    post = { ...options, scope: { kind: 'post', slug: 'alpha' } };
    await mkdir(join(root, 'posts', 'alpha'), { recursive: true });
    await mkdir(join(root, 'posts', 'beta'), { recursive: true });
    await writeFile(join(root, 'posts', 'alpha', 'index.mdx'), '# Alpha\n');
    await writeFile(join(root, 'posts', 'beta', 'index.md'), '# Beta\n');
  });

  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  async function put(id: string, value = id): Promise<string> {
    const path = join(options.directory, id);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
    return path;
  }

  it('limits a post catalog to its exact directory while preserving global IDs and URLs', async () => {
    await put('global.csv');
    await put('alpha/own.csv');
    await put('alpha/nested/data.csv');
    await put('alphabet/other.csv');
    await put('beta/other.csv');
    expect((await listAttachments(options)).length).toBe(5);
    const items = await listAttachments(post);
    expect(items.map((item) => item.id)).toEqual(['alpha/nested/data.csv', 'alpha/own.csv']);
    expect(items[0].url).toBe('/notes/downloads/alpha/nested/data.csv');
    await symlink(root, join(options.directory, 'unsafe-elsewhere'));
    expect((await listAttachments(post)).length).toBe(2);
    await expect(listAttachments(options)).rejects.toMatchObject({ status: 400 });
  });

  it('requires a real article and rejects malformed or linked post identities', async () => {
    await expect(listAttachments({ ...options, scope: { kind: 'post', slug: 'missing' } })).rejects.toMatchObject({ status: 404 });
    for (const slug of ['', '..', '../beta', '/beta', 'alpha/beta', '.hidden', 'a\\b']) {
      await expect(listAttachments({ ...options, scope: { kind: 'post', slug } })).rejects.toMatchObject({ status: 400 });
    }
    await rm(join(root, 'posts', 'alpha', 'index.mdx'));
    await symlink(join(root, 'posts', 'beta', 'index.md'), join(root, 'posts', 'alpha', 'index.mdx'));
    await expect(listAttachments(post)).rejects.toMatchObject({ status: 400 });
  });

  it('supports empty relative upload groups in both global and post scopes', async () => {
    expect((await storeAttachment('', 'root.csv', body('root'), options)).id).toBe('root.csv');
    const own = await storeAttachment('', 'own.csv', body('own'), post);
    expect(own.id).toBe('alpha/own.csv');
    expect(own.reference).toBe('attachment:alpha/own.csv');
    expect((await storeAttachment('nested/中文', 'data.csv', body('nested'), post)).id).toBe('alpha/nested/中文/data.csv');
    await expect(storeAttachment('../beta', 'escape.csv', body('bad'), post)).rejects.toMatchObject({ status: 400 });
    await expect(lstat(join(options.directory, 'beta', 'escape.csv'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('enforces the same scope boundary on resolve, rename, replace, and delete', async () => {
    for (const id of ['root.csv', 'beta/data.csv', 'alphabet/data.csv']) {
      const path = await put(id, 'original');
      await expect(resolveAttachment(`attachment:${id}`, post)).rejects.toMatchObject({ status: 403 });
      await expect(renameAttachment(id, 'renamed.csv', post)).rejects.toMatchObject({ status: 403 });
      await expect(replaceAttachment(id, body('changed'), post)).rejects.toMatchObject({ status: 403 });
      await expect(deleteAttachment(id, post)).rejects.toMatchObject({ status: 403 });
      expect(await readFile(path, 'utf8')).toBe('original');
    }
  });

  it('renames only the basename without overwriting another file', async () => {
    await put('alpha/nested/data.csv', 'data');
    await put('alpha/nested/taken.csv', 'existing');
    await expect(renameAttachment('alpha/nested/data.csv', '../elsewhere.csv', post)).rejects.toMatchObject({ status: 400 });
    await expect(renameAttachment('alpha/nested/data.csv', 'taken.csv', post)).rejects.toMatchObject({ status: 409 });
    const renamed = await renameAttachment('alpha/nested/data.csv', '新名字.csv', post);
    expect(renamed.id).toBe('alpha/nested/新名字.csv');
    expect(await readFile(join(options.directory, renamed.id), 'utf8')).toBe('data');
    expect(await readFile(join(options.directory, 'alpha/nested/taken.csv'), 'utf8')).toBe('existing');
    await expect(lstat(join(options.directory, 'alpha/nested/data.csv'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rechecks persisted references before destructive operations and allows identity-preserving replacement', async () => {
    await put('alpha/data.csv', 'old');
    const article = join(root, 'posts', 'beta', 'index.md');
    await writeFile(article, '[data][source]\n\n[source]: attachment:alpha/data.csv\n');
    await expect(renameAttachment('alpha/data.csv', 'new.csv', post)).rejects.toMatchObject({ status: 409 });
    await expect(deleteAttachment('alpha/data.csv', post)).rejects.toThrow('替换');
    const replaced = await replaceAttachment('alpha/data.csv', body('complete replacement'), post);
    expect(replaced.id).toBe('alpha/data.csv');
    expect(replaced.reference).toBe('attachment:alpha/data.csv');
    expect(await readFile(join(options.directory, replaced.id), 'utf8')).toBe('complete replacement');
    await writeFile(article, '# No references\n');
    await deleteAttachment('alpha/data.csv', post);
    expect(await listAttachments(post)).toEqual([]);
  });

  it('reports a bounded list of public reference locations and the remaining count', async () => {
    await put('alpha/data.bin', 'original');
    await writeFile(join(root, 'posts', 'beta', 'index.md'),
      Array.from({ length: 10 }, () => '[data](attachment:alpha/data.bin)').join('\n\n'));
    const failure = await deleteAttachment('alpha/data.bin', post).catch((error: unknown) => error) as Error & { status: number };
    expect(failure.status).toBe(409);
    expect(failure.message).toContain('posts/beta/index.md:1:1');
    expect(failure.message).toContain('posts/beta/index.md:15:1');
    expect(failure.message).not.toContain('posts/beta/index.md:17:1');
    expect(failure.message).toContain('另有 2 处');
    expect(failure.message).not.toContain(root);
  });

  it('fails closed on unparseable content without leaking checkout paths', async () => {
    await put('alpha/data.bin', 'original');
    await writeFile(join(root, 'posts', 'alpha', 'index.mdx'), '<Broken');
    const failure = await deleteAttachment('alpha/data.bin', post).catch((error: unknown) => error) as Error & { status: number };
    expect(failure.status).toBe(409);
    expect(failure.message).toContain('posts/alpha/index.mdx');
    expect(failure.message).not.toContain(root);
    expect(await readFile(join(options.directory, 'alpha/data.bin'), 'utf8')).toBe('original');
  });

  it('keeps the old file visible until replacement closes and serializes a concurrent global rename', async () => {
    const path = await put('alpha/data.bin', 'original');
    let release!: () => void;
    let signalBlocked!: () => void;
    const gate = new Promise<void>((resolveGate) => { release = resolveGate; });
    const blocked = new Promise<void>((resolveBlocked) => { signalBlocked = resolveBlocked; });
    const slow = new ReadableStream<Uint8Array>({
      async pull(controller) {
        signalBlocked();
        await gate;
        controller.enqueue(new Uint8Array([0, 255, 13, 10]));
        controller.close();
      },
    }, { highWaterMark: 0 });
    const replacing = replaceAttachment('alpha/data.bin', slow, post);
    await blocked;
    let renamed = false;
    const renaming = renameAttachment('alpha/data.bin', 'renamed.bin', options).then((item) => { renamed = true; return item; });
    try {
      await new Promise((resolveTurn) => setTimeout(resolveTurn, 20));
      expect(renamed).toBe(false);
      expect(await readFile(path, 'utf8')).toBe('original');
      expect((await listAttachments(post)).map((item) => item.id)).toEqual(['alpha/data.bin']);
    } finally {
      release();
      await replacing;
    }
    const result = await renaming;
    expect(result.id).toBe('alpha/renamed.bin');
    expect(new Uint8Array(await readFile(join(options.directory, result.id)))).toEqual(new Uint8Array([0, 255, 13, 10]));
    expect(await readdir(join(options.directory, 'alpha'))).toEqual(['renamed.bin']);
  });

  it('preserves the old bytes after a failed replacement and keeps the mutation queue usable', async () => {
    const path = await put('alpha/data.bin', 'original');
    const oversized = replaceAttachment('alpha/data.bin', body(new Uint8Array(MAX_ATTACHMENT_UPLOAD_BYTES + 1)), post);
    const queued = renameAttachment('alpha/data.bin', 'after.bin', options);
    await expect(oversized).rejects.toMatchObject({ status: 413 });
    const renamed = await queued;
    expect(await readFile(join(options.directory, renamed.id), 'utf8')).toBe('original');
    expect(await readdir(dirname(path))).toEqual(['after.bin']);
  });

  it('rejects symbolic mutation sources and leaves external files unchanged', async () => {
    const outside = join(root, 'outside.bin');
    await writeFile(outside, 'external');
    await mkdir(join(options.directory, 'alpha'), { recursive: true });
    await symlink(outside, join(options.directory, 'alpha', 'linked.bin'));
    await expect(renameAttachment('alpha/linked.bin', 'new.bin', post)).rejects.toMatchObject({ status: 400 });
    await expect(replaceAttachment('alpha/linked.bin', body('new'), post)).rejects.toMatchObject({ status: 400 });
    await expect(deleteAttachment('alpha/linked.bin', post)).rejects.toMatchObject({ status: 400 });
    expect(await readFile(outside, 'utf8')).toBe('external');
  });
});
