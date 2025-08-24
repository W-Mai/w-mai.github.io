// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import {defineConfig, passthroughImageService} from 'astro/config';
import {astroExpressiveCode} from "@astrojs/starlight/expressive-code";
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://benign.host',
  integrations: [astroExpressiveCode(), mdx(), sitemap()],

  image: {
      service: passthroughImageService()
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': new URL('./src', import.meta.url).pathname
      }
    }
  }
});