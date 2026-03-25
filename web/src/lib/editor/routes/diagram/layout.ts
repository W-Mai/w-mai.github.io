import type { APIRoute } from 'astro';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const prerender = false;

const layoutPath = resolve(process.cwd(), 'src', 'data', 'diagram-layout.json');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/editor/diagram-layout — read saved group positions */
export const GET: APIRoute = async () => {
  try {
    const content = await readFile(layoutPath, 'utf-8');
    return json(JSON.parse(content));
  } catch {
    return json({});
  }
};

/** PUT /api/editor/diagram-layout — save group positions */
export const PUT: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    await writeFile(layoutPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
