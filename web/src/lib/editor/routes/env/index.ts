import type { APIRoute } from 'astro';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const prerender = false;

const envPath = resolve(process.cwd(), '..', '.env');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Parse .env content into key-value pairs */
function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** Serialize key-value pairs back to .env format */
function serializeEnv(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n';
}

/** GET /api/editor/env — read all env vars from .env */
export const GET: APIRoute = async () => {
  try {
    const content = await readFile(envPath, 'utf-8');
    return json(parseEnv(content));
  } catch {
    return json({});
  }
};

/** PUT /api/editor/env — write env vars to .env and update process.env */
export const PUT: APIRoute = async ({ request }) => {
  try {
    const vars: Record<string, string> = await request.json();
    await writeFile(envPath, serializeEnv(vars), 'utf-8');
    // Update process.env so changes take effect without restart
    for (const [k, v] of Object.entries(vars)) {
      process.env[k] = v;
    }
    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
