// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import {defineConfig} from 'astro/config';
import {astroExpressiveCode} from "@astrojs/starlight/expressive-code";
import tailwindcss from '@tailwindcss/vite';
import astroMermaid from 'astro-mermaid';
import editorDev from './src/lib/editor-dev-plugin';

// https://astro.build/config
export default defineConfig({
  site: 'https://benign.host',
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
    resolve: {
      alias: {
        '~': new URL('./src', import.meta.url).pathname,
        '@posts': new URL('../posts', import.meta.url).pathname,
      }
    }
  }
});