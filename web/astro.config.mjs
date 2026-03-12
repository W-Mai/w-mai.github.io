// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import {defineConfig} from 'astro/config';
import {astroExpressiveCode} from "@astrojs/starlight/expressive-code";
import tailwindcss from '@tailwindcss/vite';
import astroMermaid from 'astro-mermaid';
import editorDev from './src/lib/editor-dev-plugin';
import remarkSticker from './src/lib/remark-sticker';
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
    sitemap(),
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
        '@posts': new URL('../posts', import.meta.url).pathname,
        '@assets': new URL('../assets', import.meta.url).pathname,
      }
    }
  }
});