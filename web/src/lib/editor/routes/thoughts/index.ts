import type { APIRoute } from 'astro';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { yamlToThought, thoughtToYaml, generateThoughtId, validateThought } from '~/lib/thought';
import { parseSiteDate } from '~/lib/date-utils';
import { SITE_TZ_OFFSET } from '~/consts';
import { json } from '../shared';

export const prerender = false;

const thoughtsDir = resolve(process.cwd(), '..', 'thoughts');

/** GET /api/editor/thoughts — list all thoughts */
export const GET: APIRoute = async () => {
  try {
    const files = (await readdir(thoughtsDir)).filter((f) => f.endsWith('.yaml'));
    const thoughts = [];
    for (const file of files) {
      try {
        const raw = await readFile(resolve(thoughtsDir, file), 'utf-8');
        const data = yamlToThought(raw);
        if (data) thoughts.push({ id: file.replace(/\.yaml$/, ''), ...data });
      } catch { /* skip invalid files */ }
    }
    thoughts.sort((a, b) => parseSiteDate(b.createdAt).getTime() - parseSiteDate(a.createdAt).getTime());
    return json(thoughts);
  } catch {
    return json([]);
  }
};

/** POST /api/editor/thoughts — create a new thought */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const validation = validateThought(body);
    if (!validation.valid) return json({ error: validation.error }, 400);

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const tzOffset = SITE_TZ_OFFSET;
    const tzSign = tzOffset >= 0 ? '+' : '-';
    const tzAbs = Math.abs(tzOffset);
    const tz = `${tzSign}${pad(tzAbs)}:00`;
    const now = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tz}`;
    const id = generateThoughtId(now);
    const filename = `${id}.yaml`;
    const filePath = resolve(thoughtsDir, filename);

    const thought = {
      content: body.content.trim(),
      createdAt: now,
      tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string' && t) : undefined,
      mood: typeof body.mood === 'string' && body.mood ? body.mood : undefined,
    };

    await writeFile(filePath, thoughtToYaml(thought), 'utf-8');
    return json({ success: true, thought: { id, ...thought } });
  } catch {
    return json({ error: 'Failed to create thought' }, 500);
  }
};
