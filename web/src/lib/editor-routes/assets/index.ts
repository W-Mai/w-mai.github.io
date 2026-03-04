import type { APIRoute } from 'astro';
import { readdir, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { computeAssetReferences } from '~/lib/editor-utils';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');
const assetsDir = resolve(postsDir, 'assets');

/** GET /api/editor/assets — list all asset files with metadata and reference counts */
export const GET: APIRoute = async () => {
  try {
    const files = await readdir(assetsDir);
    const assetNames = files.filter((f) => !f.startsWith('.'));

    const refs = await computeAssetReferences(postsDir, assetNames);

    const assets = await Promise.all(
      assetNames.map(async (name) => {
        const filePath = resolve(assetsDir, name);
        const info = await stat(filePath);
        const referencedBy = refs.get(name) || [];
        return {
          name,
          size: info.size,
          ext: extname(name).toLowerCase(),
          refCount: referencedBy.length,
          referencedBy,
        };
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
