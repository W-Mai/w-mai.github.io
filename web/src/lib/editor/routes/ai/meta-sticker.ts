import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readMetaMap, writeMetaMap, type StickerMeta } from '../stickers/meta';
import { json } from '../shared';
import { getVisionConfig, completeJSON, extractJSON } from '~/lib/editor/ai-client';

export const prerender = false;

const stickersDir = resolve(process.cwd(), '..', 'assets', 'stickers');

/** Read sticker file as base64 data URL */
function readStickerBase64(name: string): string {
  const data = readFileSync(resolve(stickersDir, name));
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  };
  return `data:${mimeMap[ext] || 'image/png'};base64,${data.toString('base64')}`;
}

const SYSTEM_PROMPT = `You are a sticker/emoji naming assistant. Given a sticker image, provide:
1. A short English kebab-case name (e.g. "tired-panda-stare", "cat-paw-punch")
2. A brief Chinese description of the sticker's meaning/emotion
3. 3-5 searchable tags in Chinese

Return ONLY valid JSON in this exact format:
{"aiName": "kebab-case-name", "description": "中文描述", "tags": ["标签1", "标签2", "标签3"]}`;

/** POST /api/editor/stickers/recognize — AI recognize a sticker */
export const POST: APIRoute = async ({ request }) => {
  let config;
  try { config = getVisionConfig(); } catch (err: any) { return json({ error: err.message }, 503); }

  let body: { filename: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  if (!body.filename) return json({ error: 'Missing filename' }, 400);

  let dataUrl: string;
  try { dataUrl = readStickerBase64(body.filename); } catch { return json({ error: 'Sticker file not found' }, 404); }

  try {
    const content = await completeJSON(config, [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: '请识别这个表情包/贴纸，给出命名和描述。' },
        ],
      },
    ], { maxTokens: 256, timeout: 30000 });

    const parsed = extractJSON<{ aiName: string; description: string; tags: string[] }>(content);

    const meta: StickerMeta = {
      filename: body.filename,
      aiName: parsed.aiName,
      description: parsed.description,
      tags: parsed.tags,
    };

    const map = await readMetaMap();
    map[body.filename] = { ...map[body.filename], ...meta };
    await writeMetaMap(map);

    return json({ success: true, meta: map[body.filename] });
  } catch (err: any) {
    if (err.name === 'AbortError') return json({ error: 'Vision request timed out (30s)' }, 504);
    return json({ error: err.message }, 502);
  }
};
