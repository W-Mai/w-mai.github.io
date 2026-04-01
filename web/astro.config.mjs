// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import {defineConfig} from 'astro/config';
import {SITE_TITLE, SITE_DESCRIPTION, AVATAR_URL} from './src/consts';
import {astroExpressiveCode} from "@astrojs/starlight/expressive-code";
import tailwindcss from '@tailwindcss/vite';
import astroMermaid from 'astro-mermaid';
import editorDev from './src/lib/editor/dev-plugin';
import remarkSticker from './src/lib/markdown/remark-sticker';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  site: 'https://benign.host',
  devToolbar: { enabled: false },
  markdown: {
    remarkPlugins: [remarkSticker, remarkMath],
    rehypePlugins: [rehypeKatex],
  },

  integrations: [
    react(),
    editorDev(),
    astroMermaid(),
    astroExpressiveCode({
      themes: ['github-light', 'github-dark'],
      themeCssSelector: (theme) => {
        if (theme.type === 'dark') return '.dark';
        return false;
      },
      useDarkModeMediaQuery: false,
      styleOverrides: {
        borderRadius: '0.5rem',
        borderColor: 'transparent',
        borderWidth: '0',
        frames: {
          frameBoxShadowCssValue: 'none',
        },
      },
    }),
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/chunks/'),
    }),
    AstroPWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: SITE_TITLE,
        short_name: SITE_TITLE,
        description: SITE_DESCRIPTION,
        theme_color: '#e0e5ec',
        background_color: '#e0e5ec',
        display: 'standalone',
        icons: [
          { src: '/pwa-icon.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: undefined,
        globPatterns: ['**/*.{html,css,js,png,jpg,svg,woff2}'],
      },
    }),
    // Download avatar as PWA icon at build/dev time
    {
      name: 'pwa-icon-fetch',
      hooks: {
        'astro:server:setup': async () => {
          const fs = await import('node:fs/promises');
          const path = await import('node:path');
          const dest = path.resolve('public', 'pwa-icon.png');
          try { await fs.access(dest); } catch {
            try {
              const res = await fetch(`${AVATAR_URL}?s=512`);
              if (res.ok) await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
            } catch {}
          }
        },
        'astro:build:done': async ({ dir }) => {
          const fs = await import('node:fs/promises');
          const path = await import('node:path');
          const dest = path.join(dir.pathname, 'pwa-icon.png');
          try {
            const res = await fetch(`${AVATAR_URL}?s=512`);
            if (res.ok) await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
          } catch {}
        },
      },
    },
  ],

  image: {
      domains: [
          'github.com',
          'raw.githubusercontent.com',
          'avatars.githubusercontent.com',
          'user-images.githubusercontent.com',
          'opengraph.githubassets.com',
      ],
  },

  vite: {
    plugins: [tailwindcss()],
    envDir: new URL('..', import.meta.url).pathname,
    resolve: {
      alias: {
        '~': new URL('./src', import.meta.url).pathname,
        '@assets': new URL('../assets', import.meta.url).pathname,
      }
    }
  }
});