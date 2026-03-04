import type { APIRoute } from 'astro';
import { readdir, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

export const prerender = false;

const assetsDir = resolve(process.cwd(), '..', 'posts', 'assets');

/** GET /api/editor/assets — list all asset files with metadata */
export const GET: APIRoute = async () => {
  try {
    const files = await readdir(assetsDir);
    const assets = await Promise.all(
      files
        .filter((f) => !f.startsWith('.'))
        .map(async (name) => {
          const filePath = resolve(assetsDir, name);
          const info = await stat(filePath);
          return { name, size: info.size, ext: extname(name).toLowerCase() };
        })
    );
    return new Response(JSON.stringify(assets), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
