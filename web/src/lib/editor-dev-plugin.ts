import type { AstroIntegration } from 'astro';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Create a Vite plugin that serves editor API routes in dev mode only */
function editorApiPlugin(postsDir: string): Plugin {
  return {
    name: 'editor-dev-api',
    handleHotUpdate({ file, server }) {
      // Intercept HMR for posts/*.mdx — send custom event instead of full reload
      if (file.startsWith(postsDir) && file.endsWith('.mdx')) {
        const slug = file.slice(postsDir.length + 1).replace(/\.mdx$/, '');
        server.ws.send({ type: 'custom', event: 'editor:post-updated', data: { slug } });
        // Return empty array to prevent default HMR / full reload
        return [];
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // GET /api/editor/posts - list all posts
        if (url === '/api/editor/posts' && req.method === 'GET') {
          try {
            const files = await readdir(postsDir);
            const slugs = files
              .filter((f) => f.endsWith('.mdx'))
              .map((f) => f.replace(/\.mdx$/, ''));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(slugs));
          } catch {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
          }
          return;
        }

        // POST /api/editor/preview - render MDX preview
        if (url === '/api/editor/preview' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', () => {
            const mdxContent = Buffer.concat(chunks).toString('utf-8');
            const bodyContent = mdxContent.replace(/^---[\s\S]*?---\s*/, '');
            const html = renderSimplePreview(bodyContent);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(html);
          });
          return;
        }

        // GET/PUT /api/editor/posts/[slug]
        const match = url.match(/^\/api\/editor\/posts\/([^/]+)$/);
        if (match) {
          const slug = match[1];
          if (!validateSlug(slug)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid slug' }));
            return;
          }

          const filePath = resolve(postsDir, `${slug}.mdx`);

          if (req.method === 'GET') {
            try {
              const content = await readFile(filePath, 'utf-8');
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.end(content);
            } catch (err: any) {
              if (err?.code === 'ENOENT') {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Post not found: ${slug}` }));
              } else {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to read file' }));
              }
            }
            return;
          }

          if (req.method === 'PUT') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', async () => {
              try {
                const content = Buffer.concat(chunks).toString('utf-8');
                await writeFile(filePath, content, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, slug }));
              } catch {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to write file' }));
              }
            });
            return;
          }
        }

        next();
      });
    },
  };
}

/** Simple markdown-to-HTML renderer for preview */
function renderSimplePreview(body: string): string {
  // Basic markdown transformations
  let html = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr />')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>');

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 72ch; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.7; }
  h1,h2,h3,h4,h5,h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
  h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
  p { margin: 1em 0; }
  code { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 0.25rem; font-size: 0.9em; }
  pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  blockquote { border-left: 3px solid #d1d5db; margin: 1em 0; padding-left: 1em; color: #6b7280; }
  a { color: #2563eb; } img { max-width: 100%; border-radius: 0.5rem; }
  ul, ol { padding-left: 1.5em; } li { margin: 0.25em 0; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
</style>
</head><body><p>${html}</p></body></html>`;
}

/** Astro integration that injects editor API in dev mode */
export default function editorDevIntegration(): AstroIntegration {
  return {
    name: 'editor-dev',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, command }) => {
        // Only inject in dev mode
        if (command !== 'dev') return;

        const postsDir = resolve(
          fileURLToPath(config.root), '..', 'posts'
        );

        updateConfig({
          vite: {
            plugins: [editorApiPlugin(postsDir)],
          },
        });
      },
    },
  };
}
