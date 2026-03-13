// Rehype plugin: resolve <img> src to local files and embed as base64 data URI.
// - Relative paths (./image.png) → resolve from posts/<slug>/ directory
// - Sticker paths (/stickers/<name>) → resolve from assets/stickers/ directory
// - Missing files → replace <img> with placeholder text

import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// web/src/lib/ → project root (three levels up from web/)
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function getMimeType(filePath: string): string {
  return MIME_MAP[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function readFileAsBase64DataUri(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const buf = readFileSync(filePath);
    const mime = getMimeType(filePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

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
        filePath = resolve(PROJECT_ROOT, 'assets', 'stickers', name);
      } else {
        // Relative path → posts/<slug>/<path>
        const relPath = src.startsWith('./') ? src.slice(2) : src;
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
