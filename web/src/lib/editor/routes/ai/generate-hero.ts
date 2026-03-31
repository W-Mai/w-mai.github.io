import type { APIRoute } from 'astro';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { json } from '../shared';
import { getChatConfig, getImageGenConfig, completeJSON, extractJSON, generateImage } from '~/lib/editor/ai-client';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

const STYLE_DESCRIPTIONS: Record<string, string> = {
  flat: '扁平插画风格，简洁几何形状，纯色块，无阴影，像 Notion/Linear 的现代设计',
  isometric: '等距2.5D视角，45度俯视的立体小场景，像乐高积木搭建的微缩世界',
  gradient: '大面积柔和渐变配合简单几何形状（圆、波浪线），像 Stripe/Vercel 的高级感设计',
  line: '单色或双色线条勾勒，留白多，极简线条艺术风格',
  soft3d: '柔和光影的3D物体，磨砂质感，像 Apple 官网产品图的柔和渲染风格',
  pixel: '复古像素画风格，8-bit 色彩，像素化的场景和物体',
  paper: '模拟剪纸/折纸的层叠效果，有纸张纹理和深度层次',
  lowpoly: '低多边形风格，三角面片构成的场景，有棱角的几何美感',
};

const PROMPT_SYSTEM = `You are an expert at writing Seedream text-to-image prompts for blog illustrations.

Prompt writing rules (Seedream best practices):
1. Use NATURAL LANGUAGE sentences in Chinese, NOT keyword lists
2. Describe a CONCRETE SCENE with specific objects
3. Structure: main subject → composition → color palette → lighting → material/texture → mood
4. Add sensory details: "金属质感的齿轮在暖光下泛着铜色光泽" beats "齿轮，金属，暖光"
5. NO text, NO letters, NO UI, NO code, NO screenshots in the image
6. Under 150 characters

CRITICAL: Understand the TECHNICAL DOMAIN from code/context, not surface keywords.
"近平面裁切" = 3D rendering, "画家算法" = depth sorting in CG, "混合模式" = pixel blending.

Return ONLY valid JSON: {"prompt": "中文提示词", "filename": "suggested-name.png"}`;

/** POST /api/editor/ai/generate-hero — Two-step image generation */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { action } = body;

  // Step 1: Generate prompt
  if (action === 'prompt') {
    let config;
    try { config = getChatConfig(); } catch (err: any) { return json({ error: err.message }, 503); }

    const styleDesc = STYLE_DESCRIPTIONS[body.style] || STYLE_DESCRIPTIONS.gradient;
    const contentText = body.content || body.selectedText || '';

    const userMessage = [
      body.title ? `Title: ${body.title}` : '',
      body.description ? `Description: ${body.description}` : '',
      body.category ? `Category: ${body.category}` : '',
      `Art style requirement: ${styleDesc}`,
      contentText ? `Content:\n${contentText.slice(0, 3500)}` : '',
    ].filter(Boolean).join('\n');

    try {
      const result = await completeJSON(config, [
        { role: 'system', content: PROMPT_SYSTEM },
        { role: 'user', content: userMessage },
      ], { maxTokens: 300, timeout: 30000 });
      const parsed = extractJSON<{ prompt: string; filename?: string }>(result);
      return json({ prompt: parsed.prompt || '', filename: parsed.filename || '' });
    } catch (err: any) {
      return json({ error: err.message }, 502);
    }
  }

  // Step 2: Generate image
  if (action === 'image') {
    let config;
    try { config = getImageGenConfig(); } catch (err: any) { return json({ error: err.message }, 503); }

    const { slug, prompt, filename, size } = body;
    if (!slug || !prompt) return json({ error: 'Missing slug or prompt' }, 400);

    const finalFilename = (filename || 'generated.jpg').replace(/[^a-zA-Z0-9._-]/g, '-');

    try {
      const url = await generateImage(config, prompt, { size: size || '3360x1120' });
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error('Failed to download generated image');
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      await writeFile(resolve(postsDir, slug, finalFilename), buffer);
      return json({ success: true, filename: finalFilename, path: `./${finalFilename}` });
    } catch (err: any) {
      if (err.name === 'AbortError') return json({ error: 'Image generation timed out' }, 504);
      return json({ error: err.message }, 502);
    }
  }

  return json({ error: `Unknown action: ${action}` }, 400);
};
