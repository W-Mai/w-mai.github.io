import type { AstroIntegration } from 'astro';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';


/** Vite plugin: intercept HMR for .mdx files to prevent full-reload */
function editorHmrPlugin(postsDir: string): Plugin {
  return {
    name: 'editor-dev-hmr',
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
