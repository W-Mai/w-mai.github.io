import type { APIRoute } from 'astro';
import { readFile, writeFile, unlink, access, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateSlug } from '~/lib/editor-utils';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/editor/posts/[slug] — read post content */
export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug || !validateSlug(slug)) return json({ error: 'Invalid slug' }, 400);

  const filePath = resolve(postsDir, slug, 'index.mdx');
  try {
    const content = await readFile(filePath, 'utf-8');
    return new Response(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: `Post not found: ${slug}` }, 404);
    return json({ error: 'Failed to read file' }, 500);
  }
};

/** PUT /api/editor/posts/[slug] — update post content */
export const PUT: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug || !validateSlug(slug)) return json({ error: 'Invalid slug' }, 400);

  const filePath = resolve(postsDir, slug, 'index.mdx');
  try {
    const content = await request.text();
    await writeFile(filePath, content, 'utf-8');
    return json({ success: true, slug });
  } catch {
    return json({ error: 'Failed to write file' }, 500);
  }
};

/** POST /api/editor/posts/[slug] — create new post */
export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug || !validateSlug(slug)) return json({ error: 'Invalid slug' }, 400);

  let title = slug;
  try {
    const body = await request.json();
    if (body.title && typeof body.title === 'string') title = body.title;
  } catch {}

  const dirPath = resolve(postsDir, slug);
  const filePath = resolve(dirPath, 'index.mdx');
  try {
    await access(filePath);
    return json({ error: `Post already exists: ${slug}` }, 409);
  } catch {
    try {
      await mkdir(dirPath, { recursive: true });
      const now = new Date();
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      const off = now.getTimezoneOffset();
      const tzSign = off <= 0 ? '+' : '-';
      const tzAbs = Math.abs(off);
      const tz = `${tzSign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}${tz}`;
      const template = `---\ntitle: '${title.replace(/'/g, "''")}'\ndescription: ''\npubDate: '${today}'\ntags: []\n---\n\nStart writing here.\n`;
      await writeFile(filePath, template, 'utf-8');
      return json({ success: true, slug });
    } catch {
      return json({ error: 'Failed to create file' }, 500);
    }
  }
};

/** DELETE /api/editor/posts/[slug] — delete post directory */
export const DELETE: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug || !validateSlug(slug)) return json({ error: 'Invalid slug' }, 400);

  const dirPath = resolve(postsDir, slug);
  try {
    await access(resolve(dirPath, 'index.mdx'));
    await rm(dirPath, { recursive: true });
    return json({ success: true, slug });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: `Post not found: ${slug}` }, 404);
    return json({ error: 'Failed to delete post' }, 500);
  }
};
