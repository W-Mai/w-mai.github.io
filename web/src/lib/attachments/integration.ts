import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, open } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import type { AstroConfig, AstroIntegration } from 'astro';
import type { Connect } from 'vite';
import remarkAttachments from '../markdown/remark-attachments';
import { attachmentFilePath, listAttachments, resolveAttachment } from './files';
import { attachmentUrl, type AttachmentOptions } from './paths';
import { validateAttachmentContentFiles } from './validate';

const VIRTUAL_CONFIG = 'virtual:attachments/config';
const RESOLVED_CONFIG = `\0${VIRTUAL_CONFIG}`;

type PluginOptions = AttachmentOptions & { attachmentRevision: string };

function hasStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error
    && typeof error.status === 'number';
}

async function assertUnusedDirectory(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`The downloads output namespace is reserved for attachments: ${path}`);
}

function downloadMiddleware(options: AttachmentOptions): Connect.NextHandleFunction {
  return (request, response, next) => {
    // Astro strips base before this handler; Connect preserves the original raw URL.
    // URL normalization here would also remove traversal segments before validation.
    const pathname = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const mount = attachmentUrl('placeholder', options.base).slice(0, -'placeholder'.length);
    if (pathname !== mount.slice(0, -1) && !pathname.startsWith(mount)) {
      next();
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    if (pathname === mount || pathname === mount.slice(0, -1)) {
      response.writeHead(404);
      response.end();
      return;
    }
    void (async () => {
      const reference = `attachment:${pathname.slice(mount.length)}`;
      const attachment = await resolveAttachment(reference, options);
      const path = await attachmentFilePath(attachment.id, options.directory);
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) {
          response.writeHead(400);
          response.end();
          return;
        }
        response.writeHead(200, {
          'Content-Type': attachment.mediaType,
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        await pipeline(handle.createReadStream({ autoClose: false }), response);
      } finally {
        await handle.close();
      }
    })().catch((error: unknown) => {
      if (response.headersSent || response.destroyed) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      const code = (error as NodeJS.ErrnoException).code;
      const status = hasStatus(error) ? error.status
        : code === 'ENOENT' || code === 'ENOTDIR' ? 404
          : code === 'ELOOP' ? 400 : undefined;
      if (status !== undefined) {
        response.writeHead(status);
        response.end();
        return;
      }
      next(error);
    });
  };
}

/** Publish root-level attachments through the same paths in dev and static output. */
export default function attachmentsIntegration(): AstroIntegration {
  // Astro and MDX keep this object; update it after every integration has configured Astro.
  const options: PluginOptions = { directory: '', base: '/', attachmentRevision: '' };
  let config: AstroConfig;
  let removeWatcher: (() => void) | undefined;

  function configure(resolved: AstroConfig): void {
    config = resolved;
    options.directory = resolve(fileURLToPath(config.root), '..', 'attachments');
    options.base = config.base;
    options.site = config.site;
  }

  return {
    name: 'content-attachments',
    hooks: {
      'astro:config:setup': ({ config: initialConfig, updateConfig }) => {
        configure(initialConfig);
        updateConfig({
          markdown: { remarkPlugins: [[remarkAttachments, options]] },
          vite: {
            plugins: [{
              name: 'attachments-config',
              resolveId(id) {
                if (id === VIRTUAL_CONFIG) return RESOLVED_CONFIG;
              },
              load(id, loadOptions) {
                if (id !== RESOLVED_CONFIG) return;
                if (!loadOptions?.ssr) throw new Error('Attachment configuration is server-only.');
                const { directory, base, site } = options;
                return `export default ${JSON.stringify({ directory, base, site })};`;
              },
            }],
          },
        });
      },
      'astro:config:done': async ({ config: resolvedConfig }) => {
        configure(resolvedConfig);
        const entries = await listAttachments(options);
        // Cached Markdown HTML contains attachment metadata, so it depends on this inventory.
        options.attachmentRevision = createHash('sha256')
          .update(JSON.stringify(entries.map(({ id, size, mediaType }) => [id, size, mediaType])))
          .digest('hex');
      },
      'astro:server:setup': async ({ server, refreshContent, logger }) => {
        await assertUnusedDirectory(join(fileURLToPath(config.publicDir), 'downloads'));
        server.middlewares.use(downloadMiddleware(options));
        const moduleImportsPath = fileURLToPath(new URL('.astro/content-modules.mjs', config.root));
        server.watcher.add([options.directory, moduleImportsPath]);
        const invalidateContentImports = () => {
          // Astro can initially resolve this import to an in-memory stub before writing the map.
          // Both resolutions must be invalidated when deferred MDX entries are added.
          for (const module of server.moduleGraph.idToModuleMap.values()) {
            if (module.id === '\0astro:content-module-imports'
              || module.id === moduleImportsPath || module.file === moduleImportsPath) {
              server.moduleGraph.invalidateModule(module);
            }
          }
        };
        let timer: ReturnType<typeof setTimeout> | undefined;
        let refresh = Promise.resolve();
        let revision = 0;
        let closed = false;
        const onChange = (_event: string, path: string) => {
          if (resolve(path) === moduleImportsPath) {
            invalidateContentImports();
            server.ws.send({ type: 'custom', event: 'attachments:updated', data: {} });
            return;
          }
          const child = relative(options.directory, resolve(path));
          if (isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`)) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            refresh = refresh.then(async () => {
              if (closed) return;
              options.attachmentRevision = `dev:${++revision}`;
              try {
                await refreshContent?.({});
              } catch (error) {
                logger.error(error instanceof Error ? error.message : String(error));
              }
              if (closed) return;
              // Collection MDX is deferred; its transformed module has a separate Vite cache.
              for (const module of server.moduleGraph.idToModuleMap.values()) {
                if (/\.mdx?(?:\?|$)/i.test(module.id ?? '')) {
                  server.moduleGraph.invalidateModule(module);
                }
              }
              // refreshContent waits for generated imports to be written. Invalidate their
              // own cached values after MDX importers, before notifying preview consumers.
              invalidateContentImports();
              server.ws.send({ type: 'custom', event: 'attachments:updated', data: {} });
            }).catch((error: unknown) => {
              logger.error(error instanceof Error ? error.message : String(error));
            });
          }, 80);
        };
        server.watcher.on('all', onChange);
        removeWatcher = () => {
          closed = true;
          clearTimeout(timer);
          server.watcher.off('all', onChange);
        };
        server.httpServer?.once('close', removeWatcher);
      },
      'astro:server:done': () => { removeWatcher?.(); },
      'astro:build:start': async () => {
        await assertUnusedDirectory(join(fileURLToPath(config.publicDir), 'downloads'));
        const repository = resolve(fileURLToPath(config.root), '..');
        await validateAttachmentContentFiles(options, {
          postsDirectory: join(repository, 'posts'),
          thoughtsDirectory: join(repository, 'thoughts'),
        });
      },
      'astro:build:generated': async ({ dir }) => {
        const destination = join(fileURLToPath(dir), 'downloads');
        await assertUnusedDirectory(destination);
        const entries = await listAttachments(options);
        if (entries.length === 0) return;
        await mkdir(destination, { recursive: true });
        for (const entry of entries) {
          const source = await attachmentFilePath(entry.id, options.directory);
          const target = join(destination, ...entry.id.split('/'));
          await mkdir(dirname(target), { recursive: true });
          await copyFile(source, target, constants.COPYFILE_EXCL);
        }
      },
    },
  };
}
