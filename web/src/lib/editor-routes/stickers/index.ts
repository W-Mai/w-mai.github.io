import type { APIRoute } from 'astro';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

export const prerender = false;

const stickersDir = resolve(process.cwd(), '..', 'posts', 'stickers');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/editor/stickers — list all stickers */
export const GET: APIRoute = async () => {
  try {
    const files = await readdir(stickersDir);
    const stickers = await Promise.all(
      files
        .filter(f => /\.(png|gif|apng|webp|jpe?g|svg)$/i.test(f))
        .map(async (name) => {
          const info = await stat(resolve(stickersDir, name));
          return { name, size: info.size };
        }),
    );
    return json(stickers);
  } catch {
    return json([]);
  }
};
