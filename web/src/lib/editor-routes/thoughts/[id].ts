import type { APIRoute } from 'astro';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { yamlToThought, thoughtToYaml, validateThought } from '../../thought-utils';
import { validateSlug } from '../../editor-utils';

export const prerender = false;

const thoughtsDir = resolve(process.cwd(), '..', 'thoughts');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/editor/thoughts/[id] — read single thought */
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id || !validateSlug(id)) return json({ error: 'Invalid id' }, 400);

  const filePath = resolve(thoughtsDir, `${id}.yaml`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const data = yamlToThought(raw);
    if (!data) return json({ error: 'Invalid YAML' }, 500);
    return json({ id, ...data });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: 'Not found' }, 404);
    return json({ error: 'Failed to read thought' }, 500);
  }
};

/** PUT /api/editor/thoughts/[id] — update thought */
export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id || !validateSlug(id)) return json({ error: 'Invalid id' }, 400);

  const filePath = resolve(thoughtsDir, `${id}.yaml`);
  try {
    // Read existing to preserve createdAt
    const raw = await readFile(filePath, 'utf-8');
    const existing = yamlToThought(raw);
    if (!existing) return json({ error: 'Invalid existing YAML' }, 500);

    const body = await request.json();
    const validation = validateThought(body);
    if (!validation.valid) return json({ error: validation.error }, 400);

    const updated = {
      content: body.content.trim(),
      createdAt: existing.createdAt,
      tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string' && t) : undefined,
      mood: typeof body.mood === 'string' && body.mood ? body.mood : undefined,
    };

    await writeFile(filePath, thoughtToYaml(updated), 'utf-8');
    return json({ success: true, thought: { id, ...updated } });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: 'Not found' }, 404);
    return json({ error: 'Failed to update thought' }, 500);
  }
};

/** DELETE /api/editor/thoughts/[id] — delete thought */
export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id || !validateSlug(id)) return json({ error: 'Invalid id' }, 400);

  const filePath = resolve(thoughtsDir, `${id}.yaml`);
  try {
    await unlink(filePath);
    return json({ success: true, id });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return json({ error: 'Not found' }, 404);
    return json({ error: 'Failed to delete thought' }, 500);
  }
};
