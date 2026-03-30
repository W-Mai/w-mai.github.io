import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSlug } from '~/lib/editor/utils';
import { json } from '~/lib/editor/routes/shared';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
  avif: 'image/avif',
};

/** GET /api/editor/posts/[slug]/images/[name] — serve co-located image */
export const GET: APIRoute = async ({ params }) => {
  const { slug, name } = params;
  if (!slug || !validateSlug(slug) || !name) return json({ error: 'Invalid params' }, 400);
  if (name.includes('/') || name.includes('\\') || name.startsWith('.')) return json({ error: 'Invalid name' }, 400);

  const filePath = resolve(postsDir, slug, name);
  try {
    const data = readFileSync(filePath);
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: 'Not found' }, 404);
    return json({ error: 'Failed to read' }, 500);
  }
};
