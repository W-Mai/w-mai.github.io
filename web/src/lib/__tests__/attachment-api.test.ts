import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_ATTACHMENT_UPLOAD_BYTES } from '../attachments/files';
import { GET, POST } from '../editor/routes/attachments';

const options = vi.hoisted(() => ({ directory: '', base: '/notes/', site: 'https://example.com' }));
vi.mock('virtual:attachments/config', () => ({ default: options }));

let temp: string;
beforeEach(async () => {
  temp = await mkdtemp(join(await realpath(tmpdir()), 'attachment-editor-api-'));
  options.directory = join(temp, 'attachments');
});
afterEach(async () => { await rm(temp, { recursive: true, force: true }); });

function apiContext(request: Request) {
  return { request, url: new URL(request.url) } as Parameters<typeof POST>[0];
}

function upload(name: string, body: BodyInit = 'sample', group = '资料/实验') {
  const query = new URLSearchParams({ group, name });
  return POST(apiContext(new Request('https://example.com/notes/api/editor/attachments?' + query, {
    method: 'POST', body,
  })));
}

describe('attachment editor API contract', () => {
  it('lists an absent directory as an empty uncached collection', async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual([]);
  });

  it('creates Unicode subdirectories, preserves bytes, and returns canonical public URLs', async () => {
    const bytes = new Uint8Array([0, 255, 13, 10, 42]);
    const response = await upload('样本 (最终).csv', bytes);
    expect(response.status).toBe(201);
    const item = await response.json();
    expect(item.id).toBe('资料/实验/样本 (最终).csv');
    expect(item.size).toBe(bytes.length);
    expect(item.reference).toContain('%28%E6%9C%80%E7%BB%88%29');
    expect(item.url).toMatch(/^\/notes\/downloads\//);
    expect(new Uint8Array(await readFile(join(options.directory, item.id)))).toEqual(bytes);
    const listed = await (await GET({} as Parameters<typeof GET>[0])).json();
    expect(listed).toEqual([item]);
  });

  it('returns a new identity on duplicate upload without replacing the first file', async () => {
    const first = await (await upload('数据.csv', 'first')).json();
    const second = await (await upload('数据.csv', 'second')).json();
    expect(first.id).toBe('资料/实验/数据.csv');
    expect(second.id).toBe('资料/实验/数据 (1).csv');
    expect(await readFile(join(options.directory, first.id), 'utf8')).toBe('first');
    expect(await readFile(join(options.directory, second.id), 'utf8')).toBe('second');
  });

  it.each([
    ['../escape', 'data.csv'],
    ['safe', '../data.csv'],
    ['safe', 'nested/data.csv'],
    ['.hidden', 'data.csv'],
  ])('rejects unsafe group/name with status 400: %s / %s', async (group, name) => {
    expect((await upload(name, 'data', group)).status).toBe(400);
  });

  it('rejects oversized declared length without creating an upload', async () => {
    const request = new Request('https://example.com/api/editor/attachments?group=safe&name=data.bin', {
      method: 'POST', body: 'small',
      headers: { 'Content-Length': String(MAX_ATTACHMENT_UPLOAD_BYTES + 1) },
    });
    expect((await POST(apiContext(request))).status).toBe(413);
    expect(await readdir(temp)).toEqual([]);
  });

  it('enforces the actual stream limit despite a small declared length and cleans the partial file', async () => {
    let sent = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent <= MAX_ATTACHMENT_UPLOAD_BYTES) {
          controller.enqueue(chunk);
          sent += chunk.byteLength;
        } else controller.close();
      },
    });
    const request = new Request('https://example.com/api/editor/attachments?group=safe&name=data.bin', {
      method: 'POST', body: stream, headers: { 'Content-Length': '1' }, duplex: 'half',
    } as RequestInit);
    expect((await POST(apiContext(request))).status).toBe(413);
    expect(await readdir(join(options.directory, 'safe'))).toEqual([]);
  });
});
