import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { DELETE, GET, PATCH, POST, PUT } from '../editor/routes/attachments';

const options = vi.hoisted(() => ({ directory: '', base: '/notes/', site: 'https://example.test' }));
vi.mock('virtual:attachments/config', () => ({ default: options }));
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(await realpath(tmpdir()), 'attachment-scope-api-'));
  options.directory = join(root, 'attachments');
  await mkdir(join(root, 'posts', 'alpha'), { recursive: true });
  await writeFile(join(root, 'posts', 'alpha', 'index.md'), '# Alpha\n');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function put(id: string, contents: string) {
  const file = join(options.directory, id);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
}

function invoke(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', query: Record<string, string>, body?: string) {
  const url = new URL('https://example.test/notes/api/editor/attachments?' + new URLSearchParams(query));
  const request = new Request(url, { method, body });
  return ({ GET, POST, PATCH, PUT, DELETE })[method]({ request, url } as Parameters<typeof GET>[0]);
}

describe('scope-aware attachment API', () => {
  it('defaults to global but enforces exact post catalogs and real post identities', async () => {
    await put('alpha/own.csv', 'own');
    await put('beta/other.csv', 'other');
    expect((await (await invoke('GET', {})).json()).length).toBe(2);
    expect((await (await invoke('GET', { scope: 'post', slug: 'alpha' })).json()).map((item: { id: string }) => item.id)).toEqual(['alpha/own.csv']);
    expect((await invoke('GET', { scope: 'post', slug: 'missing' })).status).toBe(404);
    expect((await invoke('GET', { scope: 'post', slug: '../alpha' })).status).toBe(400);
    expect((await invoke('GET', { scope: 'invalid' })).status).toBe(400);
  });

  it('creates root files and post-relative files through empty groups', async () => {
    const global = await invoke('POST', { group: '', name: 'root.txt' }, 'global');
    expect(global.status).toBe(201);
    expect((await global.json()).id).toBe('root.txt');
    const scoped = await invoke('POST', { scope: 'post', slug: 'alpha', group: '', name: 'data.txt' }, 'post');
    expect(scoped.status).toBe(201);
    expect((await scoped.json()).id).toBe('alpha/data.txt');
  });

  it('cannot mutate another post through a forged global ID', async () => {
    await put('beta/data.txt', 'unchanged');
    const scope = { scope: 'post', slug: 'alpha' };
    expect((await invoke('PATCH', scope, JSON.stringify({ id: 'beta/data.txt', name: 'new.txt' }))).status).toBe(403);
    expect((await invoke('PUT', { ...scope, id: 'beta/data.txt' }, 'changed')).status).toBe(403);
    expect((await invoke('DELETE', { ...scope, id: 'beta/data.txt' })).status).toBe(403);
    expect(await readFile(join(options.directory, 'beta/data.txt'), 'utf8')).toBe('unchanged');
  });

  it.each([':attachment[alpha/data.txt]:', '::attachment[alpha/data.txt]::'])(
    'protects references and allows replacement with the same identity: %s', async (syntax) => {
    await put('alpha/data.txt', 'old');
    await writeFile(join(root, 'posts', 'alpha', 'index.md'), '# Source\n\n' + syntax + '\n');
    const scope = { scope: 'post', slug: 'alpha' };
    const conflict = await invoke('DELETE', { ...scope, id: 'alpha/data.txt' });
    expect(conflict.status).toBe(409);
    const conflictMessage = (await conflict.json()).error;
    expect(conflictMessage).toContain('替换');
    expect(conflictMessage).toContain('posts/alpha/index.md:3:1');
    expect((await invoke('PATCH', scope, JSON.stringify({ id: 'alpha/data.txt', name: 'changed.txt' }))).status).toBe(409);
    const replaced = await invoke('PUT', { ...scope, id: 'alpha/data.txt' }, 'complete new bytes');
    expect(replaced.status).toBe(200);
    expect((await replaced.json()).id).toBe('alpha/data.txt');
    expect(await readFile(join(options.directory, 'alpha/data.txt'), 'utf8')).toBe('complete new bytes');
    await writeFile(join(root, 'posts', 'alpha', 'index.md'), '# No reference\n');
    const renamed = await invoke('PATCH', scope, JSON.stringify({ id: 'alpha/data.txt', name: 'renamed.txt' }));
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).id).toBe('alpha/renamed.txt');
    expect((await invoke('DELETE', { ...scope, id: 'alpha/renamed.txt' })).status).toBe(200);
  });

  it('rejects malformed mutation requests without silently changing scope', async () => {
    expect((await invoke('PATCH', {}, '{')).status).toBe(400);
    expect((await invoke('PATCH', {}, JSON.stringify({ id: 7, name: 'x' }))).status).toBe(400);
    expect((await invoke('PUT', {}, 'body')).status).toBe(400);
    expect((await invoke('DELETE', {})).status).toBe(400);
    expect((await invoke('POST', { scope: 'post', slug: 'missing', name: 'x' }, 'body')).status).toBe(404);
  });
});
