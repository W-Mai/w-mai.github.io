// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import {defineConfig, passthroughImageService} from 'astro/config';
import {astroExpressiveCode, pluginFrames, pluginTextMarkers} from "astro-expressive-code";

// https://astro.build/config
export default defineConfig({
    site: 'https://benign.host',
    integrations: [astroExpressiveCode({
        plugins: [
            pluginFrames(),
            pluginTextMarkers()
        ],
    }), mdx(), sitemap()],
    image: {
        service: passthroughImageService()
    }
});
