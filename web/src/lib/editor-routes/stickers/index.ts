import type { APIRoute } from 'astro';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readMetaMap, type StickerMeta } from './meta';

export const prerender = false;

const stickersDir = resolve(process.cwd(), '..', 'assets', 'stickers');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/editor/stickers — list all stickers with meta */
export const GET: APIRoute = async () => {
  try {
    const [files, metaMap] = await Promise.all([readdir(stickersDir), readMetaMap()]);
    const stickers = await Promise.all(
      files
        .filter(f => /\.(png|gif|apng|webp|jpe?g|svg)$/i.test(f))
        .map(async (name) => {
          const info = await stat(resolve(stickersDir, name));
          const meta: StickerMeta | undefined = metaMap[name];
          return { name, size: info.size, meta };
        }),
    );
    return json(stickers);
  } catch {
    return json([]);
  }
};
