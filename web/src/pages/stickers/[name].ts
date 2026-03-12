import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const stickersDir = resolve(process.cwd(), '..', 'assets', 'stickers');
const STICKER_EXT = /\.(png|gif|apng|webp|jpe?g|svg)$/i;

export const getStaticPaths: GetStaticPaths = () => {
  try {
    const files = readdirSync(stickersDir).filter(f => STICKER_EXT.test(f));
    return files.map(name => ({ params: { name } }));
  } catch {
    return [];
  }
};

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', apng: 'image/apng', webp: 'image/webp',
  svg: 'image/svg+xml',
};

export const GET: APIRoute = ({ params }) => {
  const { name } = params;
  if (!name) return new Response('Not found', { status: 404 });

  try {
    const data = readFileSync(resolve(stickersDir, name));
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
