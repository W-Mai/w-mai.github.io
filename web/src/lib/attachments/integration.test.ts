import { EventEmitter } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AstroConfig, AstroIntegration } from 'astro';
import type { Connect } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import attachmentsIntegration from './integration';
import type { AttachmentOptions } from './paths';

type InstalledConfig = {
  markdown: { remarkPlugins: [[unknown, AttachmentOptions & { attachmentRevision: string }]] };
  vite: { plugins: [{ resolveId: (id: string) => string; load: (id: string, options: { ssr: boolean }) => string }] };
};

describe('attachment publishing contract', () => {
  let repository: string;
  let directory: string;
  let config: AstroConfig;
  let integration: AstroIntegration;
  let installed: InstalledConfig;
  const cleanup: (() => Promise<void>)[] = [];

  async function hook(name: keyof AstroIntegration['hooks'], parameters: unknown = {}) {
    const callback = integration.hooks[name] as ((value: unknown) => unknown) | undefined;
    return callback?.(parameters);
  }

  async function configure() {
    await hook('astro:config:setup', {
      config,
      updateConfig: (value: InstalledConfig) => { installed = value; },
    });
    await hook('astro:config:done', { config });
  }

  async function attachment(id: string, contents: string | Uint8Array) {
    const path = join(directory, id);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, contents);
    return path;
  }

  async function development() {
    let middleware: Connect.NextHandleFunction;
    const server = createServer((request, response) => {
      const incoming = request as Connect.IncomingMessage;
      incoming.originalUrl = incoming.url;
      if (incoming.url?.startsWith('/docs/')) incoming.url = incoming.url.slice('/docs'.length);
      middleware(incoming, response, () => { response.writeHead(404); response.end(); });
    });
    const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
    const modules = [
      { id: '/post.mdx' }, { id: '/post.md' }, { id: '/page.astro' },
      { id: '\0astro:content-module-imports' },
      { id: join(repository, 'web', '.astro', 'content-modules.mjs') },
    ];
    const moduleGraph = {
      idToModuleMap: new Map(modules.map((module) => [module.id, module])),
      invalidateModule: vi.fn(),
    };
    const refreshContent = vi.fn(async () => {});
    const send = vi.fn();
    const error = vi.fn();
    await hook('astro:server:setup', {
      server: {
        middlewares: { use: (value: Connect.NextHandleFunction) => { middleware = value; } },
        watcher, moduleGraph, ws: { send }, httpServer: server,
      },
      refreshContent,
      logger: { error },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    cleanup.push(async () => {
      await hook('astro:server:done');
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });
    const port = (server.address() as AddressInfo).port;
    const request = (path: string, method = 'GET') => new Promise<{
      status: number; body: Buffer; headers: import('node:http').IncomingHttpHeaders;
    }>((resolve, reject) => {
      const outgoing = httpRequest({ hostname: '127.0.0.1', port, path, method, headers: { Connection: 'close' } }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode!, body: Buffer.concat(chunks), headers: response.headers,
        }));
      });
      outgoing.on('error', reject);
      outgoing.end();
    });
    // Send malformed paths verbatim: URL-based HTTP clients can normalize dot segments.
    const rawStatus = (path: string) => new Promise<number>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = connect(port, '127.0.0.1', () => {
        socket.write(`GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
      });
      socket.setTimeout(2_000, () => socket.destroy(new Error('Raw HTTP fixture timed out')));
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('error', reject);
      socket.on('end', () => {
        const status = /^HTTP\/1\.1 (\d{3}) /.exec(Buffer.concat(chunks).toString('latin1'));
        if (!status) reject(new Error('Raw HTTP fixture received no status line'));
        else resolve(Number(status[1]));
      });
    });
    return { request, rawStatus, watcher, moduleGraph, refreshContent, send, error };
  }

  beforeEach(async () => {
    repository = await mkdtemp(join(await realpath(tmpdir()), 'astro attachments 中文 '));
    directory = join(repository, 'attachments');
    await mkdir(join(repository, 'web', 'public'), { recursive: true });
    config = {
      root: pathToFileURL(`${join(repository, 'web')}/`),
      publicDir: pathToFileURL(`${join(repository, 'web', 'public')}/`),
      base: '/docs', site: 'https://example.test',
    } as AstroConfig;
    integration = attachmentsIntegration();
  });

  afterEach(async () => {
    for (const close of cleanup.splice(0)) await close();
    await rm(repository, { recursive: true, force: true });
  });

  it('shares final root/base/site with Markdown and the server-only virtual configuration', async () => {
    await hook('astro:config:setup', {
      config: { ...config, root: pathToFileURL('/initial/web/'), base: '/', site: undefined },
      updateConfig: (value: InstalledConfig) => { installed = value; },
    });
    const options = installed.markdown.remarkPlugins[0][1];
    await hook('astro:config:done', { config });
    expect(options).toMatchObject({ directory, base: '/docs', site: 'https://example.test' });
    const plugin = installed.vite.plugins[0];
    expect(() => plugin.load(plugin.resolveId('virtual:attachments/config'), { ssr: false }))
      .toThrow('server-only');
    expect(plugin.load(plugin.resolveId('virtual:attachments/config'), { ssr: true }))
      .toBe(`export default ${JSON.stringify({ directory, base: '/docs', site: 'https://example.test' })};`);
  });

  it('serves exact bytes through GET and metadata-only HEAD under the configured base', async () => {
    const bytes = Buffer.from([0, 1, 127, 128, 255]);
    await attachment('组/空 格.bin', bytes);
    await configure();
    const { request } = await development();
    const path = '/docs/downloads/%E7%BB%84/%E7%A9%BA%20%E6%A0%BC.bin';
    const get = await request(`${path}?v=1`);
    expect(get.status).toBe(200);
    expect(get.body).toEqual(bytes);
    expect(get.headers['content-type']).toBe('application/octet-stream');
    expect(get.headers['content-length']).toBe('5');
    const head = await request(path, 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body.length).toBe(0);
    expect(head.headers['content-length']).toBe('5');
    expect((await request(path.replace('/docs', ''))).status).toBe(404);
    expect((await request(path, 'POST')).status).toBe(405);
  });

  it('does not serve invalid identifiers, missing files, directories, or late symlinks', async () => {
    await attachment('group/safe.txt', 'safe');
    await configure();
    const { request, rawStatus } = await development();
    for (const path of ['../secret', '%2e%2e/secret', 'group%2fsafe.txt', '%ZZ', '.hidden', 'group//safe.txt']) {
      expect(await rawStatus(`/docs/downloads/${path}`), path).toBe(400);
    }
    expect((await request('/docs/downloads/missing.txt')).status).toBe(404);
    expect((await request('/docs/downloads')).status).toBe(404);
    expect((await request('/docs/downloads/')).status).toBe(404);
    expect((await request('/docs/downloads/group')).status).not.toBe(200);
    await symlink(join(directory, 'group', 'safe.txt'), join(directory, 'escape.txt'));
    expect((await request('/docs/downloads/escape.txt')).status).toBe(400);
  });

  it('publishes the complete safe inventory to the hook output URL without changing bytes', async () => {
    const files = new Map([
      ['README.md', Buffer.from('[raw](group/data.csv)')],
      ['group/data.csv', Buffer.from('x,y\n1,2\n')],
      ['group/archive.zip', Buffer.from([80, 75, 3, 4, 0, 255])],
    ]);
    for (const [id, bytes] of files) await attachment(id, bytes);
    await configure();
    const output = join(repository, 'custom 输出');
    await hook('astro:build:generated', { dir: pathToFileURL(`${output}/`) });
    for (const [id, bytes] of files) expect(await readFile(join(output, 'downloads', id))).toEqual(bytes);
    await expect(hook('astro:build:generated', { dir: pathToFileURL(`${output}/`) }))
      .rejects.toThrow('namespace is reserved');
  });

  it('permits an absent source directory while reserving the public output namespace', async () => {
    await configure();
    await expect(hook('astro:build:start')).resolves.toBeUndefined();
    await expect(hook('astro:build:generated', { dir: pathToFileURL(`${join(repository, 'output')}/`) }))
      .resolves.toBeUndefined();
    await mkdir(join(repository, 'web', 'public', 'downloads'));
    await expect(hook('astro:build:start')).rejects.toThrow('namespace is reserved');
  });

  it('validates source links on every build even when the Markdown source is unchanged', async () => {
    const path = await attachment('group/data.csv', 'a,b');
    const posts = join(repository, 'posts');
    await mkdir(posts);
    await writeFile(join(posts, 'entry.mdx'), '[data](attachment:group/data.csv)');
    await configure();
    await expect(hook('astro:build:start')).resolves.toBeUndefined();
    await rm(path);
    await expect(hook('astro:build:start')).rejects.toThrow('attachment:group/data.csv');
  });

  it('invalidates both deferred import maps when a newly created MDX entry is published', async () => {
    await configure();
    const dev = await development();
    const imports = join(repository, 'web', '.astro', 'content-modules.mjs');
    dev.watcher.emit('all', 'change', imports);
    expect(dev.moduleGraph.invalidateModule.mock.calls.map(([module]) => module.id))
      .toEqual(['\0astro:content-module-imports', imports]);
    expect(dev.refreshContent).not.toHaveBeenCalled();
    expect(dev.send).toHaveBeenCalledWith({ type: 'custom', event: 'attachments:updated', data: {} });
    expect(dev.moduleGraph.invalidateModule.mock.invocationCallOrder.at(-1))
      .toBeLessThan(dev.send.mock.invocationCallOrder[0]);
  });

  it('refreshes content and Markdown modules before a non-destructive editor event', async () => {
    const path = await attachment('group/data.csv', 'old');
    await configure();
    const options = installed.markdown.remarkPlugins[0][1];
    const before = options.attachmentRevision;
    const dev = await development();
    dev.watcher.emit('all', 'change', join(repository, 'elsewhere.txt'));
    dev.watcher.emit('all', 'change', path);
    await vi.waitFor(() => expect(dev.send).toHaveBeenCalledOnce());
    expect(options.attachmentRevision).not.toBe(before);
    expect(dev.refreshContent).toHaveBeenCalledExactlyOnceWith({});
    expect(dev.moduleGraph.invalidateModule.mock.calls.map(([module]) => module.id))
      .toEqual([
        '/post.mdx', '/post.md', '\0astro:content-module-imports',
        join(repository, 'web', '.astro', 'content-modules.mjs'),
      ]);
    expect(dev.send).toHaveBeenCalledWith({ type: 'custom', event: 'attachments:updated', data: {} });
    expect(dev.refreshContent.mock.invocationCallOrder[0]).toBeLessThan(dev.send.mock.invocationCallOrder[0]);
    expect(dev.error).not.toHaveBeenCalled();
  });
});
