import type { APIRoute } from 'astro';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { json } from '../shared';

export const prerender = false;

const stickersDir = resolve(process.cwd(), '..', 'assets', 'stickers');
const metaPath = resolve(stickersDir, '_meta.json');

export interface StickerMeta {
  /** Original filename */
  filename: string;
  /** AI-suggested semantic name */
  aiName?: string;
  /** AI-generated description */
  description?: string;
  /** Searchable tags */
  tags?: string[];
}

export type StickerMetaMap = Record<string, StickerMeta>;

/** Read meta map from disk */
export async function readMetaMap(): Promise<StickerMetaMap> {
  try {
    const raw = await readFile(metaPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Write meta map to disk */
export async function writeMetaMap(map: StickerMetaMap): Promise<void> {
  await writeFile(metaPath, JSON.stringify(map, null, 2) + '\n', 'utf-8');
}

/** GET /api/editor/stickers/meta — read all sticker meta */
export const GET: APIRoute = async () => {
  const meta = await readMetaMap();
  return json(meta);
};

/** PUT /api/editor/stickers/meta — update meta for a single sticker */
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body: { filename: string; meta: Partial<StickerMeta> } = await request.json();
    if (!body.filename) return json({ error: 'Missing filename' }, 400);

    const map = await readMetaMap();
    map[body.filename] = { ...map[body.filename], filename: body.filename, ...body.meta };
    await writeMetaMap(map);
    return json({ success: true, meta: map[body.filename] });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
