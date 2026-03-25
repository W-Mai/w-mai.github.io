// Rehype plugin: resolve <img> src to local files and embed as base64 data URI.
// - Relative paths (./image.png) → resolve from posts/<slug>/ directory
// - Sticker paths (/stickers/<name>) → resolve from assets/stickers/ directory
// - Missing files → replace <img> with placeholder text

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFileAsBase64DataUri, STICKERS_DIR } from './sticker-utils';

// web/src/lib/ → project root (three levels up from web/)
const PROJECT_ROOT = resolve(STICKERS_DIR, '..', '..');

export interface RehypeBase64EmbedOptions {
  slug: string;
}

export default function rehypeBase64Embed(options: RehypeBase64EmbedOptions) {
  const { slug } = options;

  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'img' || index == null || !parent) return;

      const src = node.properties?.src;
      if (typeof src !== 'string') return;

      const isSticker = src.startsWith('/stickers/');
      const isRelative = src.startsWith('./') || src.startsWith('../');

      if (!isSticker && !isRelative) return;

      let filePath: string;
      let filename: string;

      if (isSticker) {
        // /stickers/<name> → assets/stickers/<name>
        const name = decodeURIComponent(src.replace('/stickers/', ''));
        filename = name;
        filePath = resolve(STICKERS_DIR, name);
      } else {
        // Relative path → posts/<slug>/<path>
        const relPath = decodeURIComponent(src.startsWith('./') ? src.slice(2) : src);
        filename = relPath;
        filePath = resolve(PROJECT_ROOT, 'posts', slug, relPath);
      }

      const dataUri = readFileAsBase64DataUri(filePath);

      if (dataUri) {
        node.properties.src = dataUri;
      } else {
        // Replace <img> with placeholder text node
        const placeholderText = isSticker
          ? `[表情缺失: ${filename}]`
          : `[图片缺失: ${filename}]`;

        const textNode: Text = { type: 'text', value: placeholderText };
        parent.children.splice(index, 1, textNode);
      }
    });
  };
}
