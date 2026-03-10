import type { AstroIntegration } from 'astro';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';


/** Vite plugin: intercept HMR for .mdx files and watch asset changes */
function editorHmrPlugin(postsDir: string): Plugin {
  const assetsDir = resolve(postsDir, 'assets');
  return {
    name: 'editor-dev-hmr',
    configureServer(server) {
      // Watch assets directory for add/delete to trigger Astro content rebuild
      server.watcher.add(assetsDir);
      const reload = () => server.ws.send({ type: 'full-reload' });
      server.watcher.on('add', (file) => { if (file.startsWith(assetsDir)) reload(); });
      server.watcher.on('unlink', (file) => { if (file.startsWith(assetsDir)) reload(); });
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(postsDir) && file.endsWith('.mdx')) {
        const slug = file.slice(postsDir.length + 1).replace(/\.mdx$/, '');
        server.ws.send({ type: 'custom', event: 'editor:post-updated', data: { slug } });
        return [];
      }
    },
  };
}


/** Astro integration: inject editor routes + HMR plugin in dev mode only */
export default function editorDevIntegration(): AstroIntegration {
  return {
    name: 'editor-dev',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, command, injectRoute }) => {
        if (command !== 'dev') return;

        const isEditorMode = process.env.EDITOR_MODE === 'true';
        const postsDir = resolve(fileURLToPath(config.root), '..', 'posts');

        // Inject editor API routes and page only in dev mode
        injectRoute({
          pattern: '/admin/live-editor',
          entrypoint: './src/lib/editor-routes/live-editor.astro',
        });
        injectRoute({
          pattern: '/api/editor/posts',
          entrypoint: './src/lib/editor-routes/posts/index.ts',
        });
        injectRoute({
          pattern: '/api/editor/posts/[slug]',
          entrypoint: './src/lib/editor-routes/posts/[slug].ts',
        });
        injectRoute({
          pattern: '/api/editor/assets',
          entrypoint: './src/lib/editor-routes/assets/index.ts',
        });
        injectRoute({
          pattern: '/api/editor/assets/[name]',
          entrypoint: './src/lib/editor-routes/assets/[name].ts',
        });
        injectRoute({
          pattern: '/api/editor/ai',
          entrypoint: './src/lib/editor-routes/ai/index.ts',
        });
        injectRoute({
          pattern: '/api/editor/posts/[slug]/rename',
          entrypoint: './src/lib/editor-routes/posts/[slug]/rename.ts',
        });
        injectRoute({
          pattern: '/api/editor/env',
          entrypoint: './src/lib/editor-routes/env/index.ts',
        });
        injectRoute({
          pattern: '/api/editor/git',
          entrypoint: './src/lib/editor-routes/git/index.ts',
        });
        injectRoute({
          pattern: '/api/editor/stickers',
          entrypoint: './src/lib/editor-routes/stickers/index.ts',
        });
        injectRoute({
          pattern: '/api/editor/stickers/meta',
          entrypoint: './src/lib/editor-routes/stickers/meta.ts',
        });
        injectRoute({
          pattern: '/api/editor/stickers/recognize',
          entrypoint: './src/lib/editor-routes/stickers/recognize.ts',
        });
        injectRoute({
          pattern: '/api/editor/stickers/[name]',
          entrypoint: './src/lib/editor-routes/stickers/[name].ts',
        });

        updateConfig({
          vite: {
            plugins: [editorHmrPlugin(postsDir) as any],
            define: {
              'import.meta.env.EDITOR_MODE': JSON.stringify(isEditorMode),
            },
          },
        });
      },
    },
  };
}
