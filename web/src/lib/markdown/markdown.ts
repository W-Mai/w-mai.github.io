// Full Markdown renderer sharing the same remark/rehype pipeline as blog posts.
// Supports: headings, bold, italic, code, links, math (KaTeX), stickers, etc.

import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkSticker from './remark-sticker';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

let processor: Awaited<ReturnType<typeof createMarkdownProcessor>> | null = null;

async function getProcessor() {
  if (!processor) {
    processor = await createMarkdownProcessor({
      remarkPlugins: [remarkSticker, remarkMath],
      rehypePlugins: [rehypeKatex],
    });
  }
  return processor;
}

/** Render Markdown to HTML using the full Astro pipeline */
export async function renderMarkdown(content: string): Promise<string> {
  const proc = await getProcessor();
  const { code } = await proc.render(content);
  return code;
}

