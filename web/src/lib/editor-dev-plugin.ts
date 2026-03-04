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


/** Astro integration: HMR plugin + EDITOR_MODE env in dev mode */
export default function editorDevIntegration(): AstroIntegration {
  return {
    name: 'editor-dev',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, command }) => {
        if (command !== 'dev') return;

        const isEditorMode = process.env.EDITOR_MODE === 'true';
        const postsDir = resolve(fileURLToPath(config.root), '..', 'posts');

        updateConfig({
          vite: {
            plugins: [editorHmrPlugin(postsDir)],
            define: {
              'import.meta.env.EDITOR_MODE': JSON.stringify(isEditorMode),
            },
          },
        });
      },
    },
  };
}
