import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readMetaMap, writeMetaMap, type StickerMeta } from './meta';

export const prerender = false;

const stickersDir = resolve(process.cwd(), '..', 'assets', 'stickers');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Get Volcengine (doubao) API config from environment */
function getVisionConfig() {
  const apiKey = import.meta.env.ARK_API_KEY || process.env.ARK_API_KEY;
  if (!apiKey) throw new Error('ARK_API_KEY environment variable is not configured');
  return {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey,
    model: 'doubao-seed-2-0-lite-260215',
  };
}

/** Read sticker file as base64 data URL */
function readStickerBase64(name: string): { dataUrl: string; mimeType: string } {
  const data = readFileSync(resolve(stickersDir, name));
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  };
  const mimeType = mimeMap[ext] || 'image/png';
  const base64 = data.toString('base64');
  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
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
  try {
    config = getVisionConfig();
  } catch (err: any) {
    return json({ error: err.message }, 503);
  }

  let body: { filename: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.filename) return json({ error: 'Missing filename' }, 400);

  let imageData;
  try {
    imageData = readStickerBase64(body.filename);
  } catch {
    return json({ error: 'Sticker file not found' }, 404);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageData.dataUrl } },
              { type: 'text', text: '请识别这个表情包/贴纸，给出命名和描述。' },
            ],
          },
        ],
        max_tokens: 256,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return json({ error: `Vision API error: ${errText}` }, 502);
    }

    const result = await res.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return json({ error: 'Failed to parse AI response', raw: content }, 502);
    }

    const parsed: { aiName: string; description: string; tags: string[] } = JSON.parse(jsonMatch[0]);

    // Save to meta
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
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return json({ error: 'Vision request timed out (30s)' }, 504);
    }
    return json({ error: `Vision request failed: ${err.message}` }, 502);
  }
};
