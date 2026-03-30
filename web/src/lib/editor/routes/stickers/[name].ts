import type { APIRoute } from 'astro';
import { writeFile, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { json } from '../shared';

export const prerender = false;

const stickersDir = resolve(process.cwd(), '..', 'assets', 'stickers');
const ALLOWED_EXT = /\.(png|gif|apng|webp|jpe?g|svg)$/i;

function validateName(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return false;
  return ALLOWED_EXT.test(name);
}

/** GET /api/editor/stickers/[name] — serve sticker file */
export const GET: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name || !validateName(name)) return json({ error: 'Invalid filename' }, 400);

  try {
    const data = readFileSync(resolve(stickersDir, name));
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', apng: 'image/apng', webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return json({ error: 'Sticker not found' }, 404);
  }
};

/** PUT /api/editor/stickers/[name] — upload sticker */
export const PUT: APIRoute = async ({ params, request }) => {
  const { name } = params;
  if (!name || !validateName(name)) return json({ error: 'Invalid filename' }, 400);

  try {
    const buf = Buffer.from(await request.arrayBuffer());
    await writeFile(resolve(stickersDir, name), buf);
    return json({ success: true, name });
  } catch {
    return json({ error: 'Failed to upload sticker' }, 500);
  }
};

/** DELETE /api/editor/stickers/[name] — delete sticker */
export const DELETE: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name || !validateName(name)) return json({ error: 'Invalid filename' }, 400);

  try {
    await unlink(resolve(stickersDir, name));
    return json({ success: true, name });
  } catch {
    return json({ error: 'Sticker not found' }, 404);
  }
};
