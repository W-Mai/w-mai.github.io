// POST /api/editor/wechat-export
// Converts MDX content to tagged HTML for WeChat export.
// Pipeline: remarkSticker + remarkMath → rehypeKatex + rehypeBase64Embed + rehypeWechatTag

import type { APIRoute } from 'astro';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkSticker from '~/lib/markdown/remark-sticker';
import remarkMdxToHtml from '~/lib/markdown/remark-mdx-to-html';
import remarkJsxSsr from '~/lib/markdown/remark-jsx-ssr';
import rehypeBase64Embed from '~/lib/markdown/rehype-base64-embed';
import rehypeCodeHighlight from '~/lib/markdown/rehype-code-highlight';
import rehypeKatexSvg from '~/lib/markdown/rehype-katex-svg';
import rehypeMermaidSvg from '~/lib/markdown/rehype-mermaid-svg';
import rehypePangu from '~/lib/markdown/rehype-pangu';
import rehypeWechatTag from '~/lib/markdown/rehype-wechat-tag';
import { getRepoRoot } from '~/lib/editor/git';
import { json } from './shared';

export const prerender = false;

/** Strip YAML frontmatter block delimited by --- */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length) : content;
}

/**
 * Build the remark/rehype processor for a given post slug.
 * `postDir` (absolute path to `posts/<slug>/`) is required so the JSX-SSR
 * plugin can resolve React component files referenced by `import` in MDX.
 */
function createWechatProcessor(slug: string, postDir: string) {
  return unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkSticker)
    .use(remarkMath)
    .use(remarkJsxSsr, { postDir })
    .use(remarkMdxToHtml)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeCodeHighlight)
    .use(rehypeKatex)
    .use(rehypeKatexSvg)
    .use(rehypeMermaidSvg, {
      mermaidOptions: { bg: '#ffffff', fg: '#1e293b', transparent: true },
    })
    .use(rehypeBase64Embed, { slug })
    .use(rehypePangu)
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
    const postDir = path.join(getRepoRoot(), 'posts', slug);
    const processor = createWechatProcessor(slug, postDir);
    const result = await processor.process(stripped);

    return json({ html: String(result) });
  } catch (err: any) {
    return json({ error: `Conversion failed: ${err.message}` }, 500);
  }
};
