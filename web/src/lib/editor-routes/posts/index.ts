import type { APIRoute } from 'astro';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

/** Extract title from MDX frontmatter */
function extractTitle(content: string): string {
  const m = content.match(/^---[\s\S]*?title:\s*['"](.+?)['"][\s\S]*?---/m);
  return m?.[1] || '';
}

/** GET /api/editor/posts — list all posts. Add ?detail for titles. */
export const GET: APIRoute = async ({ url }) => {
  try {
    const files = await readdir(postsDir);
    const mdxFiles = files.filter((f) => f.endsWith('.mdx'));
    const detail = url.searchParams.has('detail');

    if (detail) {
      const posts = await Promise.all(
        mdxFiles.map(async (f) => {
          const slug = f.replace(/\.mdx$/, '');
          let title = '';
          try {
            const content = await readFile(resolve(postsDir, f), 'utf-8');
            title = extractTitle(content);
          } catch {}
          return { slug, title };
        })
      );
      return new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json' } });
    }

    const slugs = mdxFiles.map((f) => f.replace(/\.mdx$/, ''));
    return new Response(JSON.stringify(slugs), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
};
