import type { APIRoute } from 'astro';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

/** GET /api/editor/posts — list all post slugs */
export const GET: APIRoute = async () => {
  try {
    const files = await readdir(postsDir);
    const slugs = files.filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
    return new Response(JSON.stringify(slugs), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
};
