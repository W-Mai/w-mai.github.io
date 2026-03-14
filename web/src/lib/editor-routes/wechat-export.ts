// POST /api/editor/wechat-export
// Converts MDX content to tagged HTML for WeChat export.
// Pipeline: remarkSticker + remarkMath → rehypeKatex + rehypeBase64Embed + rehypeWechatTag

import type { APIRoute } from 'astro';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkSticker from '../remark-sticker';
import remarkMdxToHtml from '../remark-mdx-to-html';
import rehypeBase64Embed from '../rehype-base64-embed';
import rehypeKatexSvg from '../rehype-katex-svg.js';
import rehypeMermaidSvg from '../rehype-mermaid-svg.js';
import rehypeWechatTag from '../rehype-wechat-tag';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Strip YAML frontmatter block delimited by --- */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length) : content;
}

/** Build the remark/rehype processor for a given post slug */
function createWechatProcessor(slug: string) {
  return unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkSticker)
    .use(remarkMath)
    .use(remarkMdxToHtml)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeKatexSvg)
    .use(rehypeMermaidSvg)
    .use(rehypeBase64Embed, { slug })
    .use(rehypeWechatTag)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { content, slug } = body as { content?: string; slug?: string };

    if (!content) return json({ error: 'Content is required' }, 400);
    if (!slug) return json({ error: 'Slug is required' }, 400);

    const stripped = stripFrontmatter(content);
    const processor = createWechatProcessor(slug);
    const result = await processor.process(stripped);

    return json({ html: String(result) });
  } catch (err: any) {
    return json({ error: `Conversion failed: ${err.message}` }, 500);
  }
};
