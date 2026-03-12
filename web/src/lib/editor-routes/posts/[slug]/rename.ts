import type { APIRoute } from 'astro';
import { access, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validatePostSlug } from '~/lib/editor-utils';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** POST /api/editor/posts/[slug]/rename — rename a post file */
export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug) return json({ error: 'Missing slug' }, 400);

  let body: { newSlug: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { newSlug } = body;
  if (!newSlug) return json({ error: 'Missing newSlug' }, 400);

  const validation = validatePostSlug(newSlug);
  if (!validation.valid) return json({ error: validation.error }, 400);

  if (slug === newSlug) return json({ error: 'New slug is the same as current slug' }, 400);

  const oldPath = resolve(postsDir, slug);
  const newPath = resolve(postsDir, newSlug);

  // Check source exists
  try {
    await access(resolve(oldPath, 'index.mdx'));
  } catch {
    return json({ error: `Post not found: ${slug}` }, 404);
  }

  // Check target does not exist
  try {
    await access(resolve(newPath, 'index.mdx'));
    return json({ error: `Post already exists: ${newSlug}` }, 409);
  } catch {
    // Target doesn't exist — good
  }

  try {
    await rename(oldPath, newPath);
    return json({ success: true, oldSlug: slug, newSlug });
  } catch {
    return json({ error: 'Failed to rename post' }, 500);
  }
};
