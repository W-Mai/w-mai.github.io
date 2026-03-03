import type { AstroIntegration } from 'astro';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { validateSlug } from './editor-utils';


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
    // Inject embed styles when ?embed is in the URL
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.originalUrl?.includes('embed')) return html;
        if (!ctx.originalUrl?.includes('/blog/')) return html;
        const embedStyle = `<style id="embed-style">
          body > header, body > footer, #progress-bar { display: none !important; }
          main > a[href="/blog"] { display: none !important; }
          main > div:last-child { display: none !important; }
          main { padding-top: 1rem !important; }
        </style>`;
        return html.replace('</head>', `${embedStyle}\n</head>`);
      },
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const fullUrl = req.url || '';

        // Only handle /api/editor/* routes
        if (!fullUrl.startsWith('/api/editor/')) return next();

        const url = fullUrl.split('?')[0];

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
