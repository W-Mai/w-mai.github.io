import type { APIRoute } from 'astro';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const prerender = false;

const CATEGORIES_FILE = resolve(process.cwd(), 'src', 'data', 'categories.ts');

/** Parse category list from categories.ts source */
function parseCategories(source: string): string[] {
  const match = source.match(/\[([^\]]*)\]/s);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Serialize category list back to categories.ts source */
function serializeCategories(cats: string[]): string {
  const items = cats.map((c) => `  '${c}',`).join('\n');
  return `/**
 * Canonical blog categories — single source of truth.
 * Add new categories here; the build-time schema validates against this list.
 */
export const CATEGORIES = [
${items}
] as const;

export type Category = (typeof CATEGORIES)[number];
`;
}

/** GET /api/editor/categories — list all categories */
export const GET: APIRoute = async () => {
  try {
    const source = await readFile(CATEGORIES_FILE, 'utf-8');
    return new Response(JSON.stringify(parseCategories(source)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  }
};

/** PUT /api/editor/categories — overwrite category list */
export const PUT: APIRoute = async ({ request }) => {
  try {
    const categories: string[] = await request.json();
    if (!Array.isArray(categories) || categories.some((c) => typeof c !== 'string')) {
      return new Response('Invalid payload', { status: 400 });
    }
    await writeFile(CATEGORIES_FILE, serializeCategories(categories), 'utf-8');
    return new Response(JSON.stringify(categories), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
};
