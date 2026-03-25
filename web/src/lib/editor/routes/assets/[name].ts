import type { APIRoute } from 'astro';
import { writeFile, unlink, access, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeAssetName, deduplicateAssetName } from '~/lib/editor/utils';

export const prerender = false;

const assetsDir = resolve(process.cwd(), '..', 'assets', 'images');

const ALLOWED_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf)$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Validate asset filename: no path traversal, allowed extensions */
function validateName(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return false;
  return ALLOWED_EXT.test(name);
}

/** GET /api/editor/assets/[name] — serve asset file */
export const GET: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name || !validateName(name)) return json({ error: 'Invalid filename' }, 400);

  const filePath = resolve(assetsDir, name);
  try {
    const data = readFileSync(filePath);
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
      avif: 'image/avif', ico: 'image/x-icon', pdf: 'application/pdf',
    };
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: 'Asset not found' }, 404);
    return json({ error: 'Failed to read asset' }, 500);
  }
};

/** POST /api/editor/assets/[name] — upload new asset (binary body) with name normalization */
export const POST: APIRoute = async ({ params, request }) => {
  const { name } = params;
  if (!name) return json({ error: 'Invalid filename' }, 400);

  // Normalize the filename
  const normalized = normalizeAssetName(name);
  if (!validateName(normalized)) return json({ error: `Invalid filename after normalization: ${normalized}` }, 400);

  // Deduplicate against existing assets
  let existing: Set<string>;
  try {
    const files = await readdir(assetsDir);
    existing = new Set(files);
  } catch {
    existing = new Set();
  }

  const finalName = deduplicateAssetName(normalized, existing);
  const filePath = resolve(assetsDir, finalName);

  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    await writeFile(filePath, bytes);
    return json({ success: true, name: finalName, originalName: name, normalized: name !== finalName });
  } catch {
    return json({ error: 'Failed to upload asset' }, 500);
  }
};

/** PUT /api/editor/assets/[name] — overwrite existing asset */
export const PUT: APIRoute = async ({ params, request }) => {
  const { name } = params;
  if (!name || !validateName(name)) return json({ error: 'Invalid filename' }, 400);

  const filePath = resolve(assetsDir, name);
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    await writeFile(filePath, bytes);
    return json({ success: true, name });
  } catch {
    return json({ error: 'Failed to write asset' }, 500);
  }
};

/** DELETE /api/editor/assets/[name] — delete asset and trigger dev server reload */
export const DELETE: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name || !validateName(name)) return json({ error: 'Invalid filename' }, 400);

  const filePath = resolve(assetsDir, name);
  try {
    await unlink(filePath);
    return json({ success: true, name });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: 'Asset not found' }, 404);
    return json({ error: 'Failed to delete asset' }, 500);
  }
};
