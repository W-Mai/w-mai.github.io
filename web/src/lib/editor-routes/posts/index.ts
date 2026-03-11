import type { APIRoute } from 'astro';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseFrontmatter } from '../../frontmatter-utils';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

/** Extract YAML text between --- delimiters */
function extractYaml(content: string): string | null {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m?.[1] ?? null;
}

/** GET /api/editor/posts — list all posts. Add ?detail for titles + metadata. */
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
          let tags: string[] = [];
          let category = '';
          let pubDate = '';
          try {
            const content = await readFile(resolve(postsDir, f), 'utf-8');
            const yaml = extractYaml(content);
            if (yaml) {
              const result = parseFrontmatter(yaml);
              if (result.ok) {
                title = result.data.title;
                tags = result.data.tags;
                category = result.data.category ?? '';
                pubDate = result.data.pubDate;
              }
            }
          } catch {}
          return { slug, title, tags, category, pubDate };
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
