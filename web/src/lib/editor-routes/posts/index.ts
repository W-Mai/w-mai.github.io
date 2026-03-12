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
    const { readdir: readdirFn, stat: statFn } = await import('node:fs/promises');
    const entries = await readdirFn(postsDir, { withFileTypes: true });
    const slugs: string[] = [];

    // Collect directories that contain index.mdx
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          await statFn(resolve(postsDir, entry.name, 'index.mdx'));
          slugs.push(entry.name);
        } catch { /* no index.mdx */ }
      }
    }

    const detail = url.searchParams.has('detail');

    if (detail) {
      const posts = await Promise.all(
        slugs.map(async (slug) => {
          let title = '';
          let tags: string[] = [];
          let category = '';
          let pubDate = '';
          try {
            const content = await readFile(resolve(postsDir, slug, 'index.mdx'), 'utf-8');
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

    return new Response(JSON.stringify(slugs), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
};
