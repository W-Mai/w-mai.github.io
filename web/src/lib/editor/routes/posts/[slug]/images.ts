import type { APIRoute } from 'astro';
import { readdir, stat, writeFile, unlink, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { validateSlug, normalizeAssetName, deduplicateAssetName } from '~/lib/editor/utils';
import { json } from '~/lib/editor/routes/shared';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');
const ALLOWED_EXT = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

/** GET /api/editor/posts/[slug]/images — list co-located images */
export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug || !validateSlug(slug)) return json({ error: 'Invalid slug' }, 400);

  const dir = resolve(postsDir, slug);
  try {
    const files = await readdir(dir);
    const images = await Promise.all(
      files
        .filter((f) => ALLOWED_EXT.test(f))
        .map(async (name) => {
          const info = await stat(resolve(dir, name));
          return { name, size: info.size, ext: extname(name).toLowerCase() };
        }),
    );
    return json(images);
  } catch {
    return json([]);
  }
};

/** POST /api/editor/posts/[slug]/images — upload image */
export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug || !validateSlug(slug)) return json({ error: 'Invalid slug' }, 400);

  const dir = resolve(postsDir, slug);
  await mkdir(dir, { recursive: true });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No file provided' }, 400);

  const normalized = normalizeAssetName(file.name);
  if (!ALLOWED_EXT.test(normalized)) return json({ error: 'Unsupported file type' }, 400);

  const existing = new Set(await readdir(dir).catch(() => [] as string[]));
  const finalName = deduplicateAssetName(normalized, existing);

  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(resolve(dir, finalName), bytes);
  return json({ success: true, name: finalName });
};

/** DELETE /api/editor/posts/[slug]/images — delete image by ?name= */
export const DELETE: APIRoute = async ({ params, url }) => {
  const { slug } = params;
  const name = url.searchParams.get('name');
  if (!slug || !validateSlug(slug)) return json({ error: 'Invalid slug' }, 400);
  if (!name || name.includes('/') || name.includes('\\')) return json({ error: 'Invalid name' }, 400);

  try {
    await unlink(resolve(postsDir, slug, name));
    return json({ success: true, name });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: 'Not found' }, 404);
    return json({ error: 'Failed to delete' }, 500);
  }
};
