import type { APIRoute } from 'astro';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { json } from '../shared';
import { getChatConfig, getImageGenConfig, completeJSON, extractJSON, generateImage } from '~/lib/editor/ai-client';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

const PROMPT_SYSTEM = `You are an expert at writing Seedream text-to-image prompts for technical blog cover illustrations.
Given a blog article's metadata and content, generate a vivid Chinese prompt for a wide banner image (3:1 ratio).

CRITICAL: First understand the article's TECHNICAL DOMAIN from the content, not from surface-level keywords.
- "近平面裁切" is about 3D rendering pipelines, NOT physical optics
- "画家算法" is about depth sorting in computer graphics, NOT actual painting
- "混合模式" is about pixel blending in image processing, NOT chemistry
- "惯性动画" is about UI physics simulation, NOT mechanical engineering
- Always read the code snippets and technical terms to determine the actual domain

Prompt writing rules (Seedream best practices):
1. Use NATURAL LANGUAGE sentences in Chinese, NOT keyword lists
2. Describe a CONCRETE SCENE that serves as a visual metaphor for the technical concept
3. Structure: main subject → composition → color palette → lighting → material/texture → artistic style
4. Add sensory details: "半透明的几何体在冷蓝色光线下投射出精确的阴影" beats "几何体，蓝光，阴影"
5. Mention "技术博客封面横幅配图" to set context
6. NO text, NO letters, NO UI, NO code, NO screenshots
7. Under 150 characters

Visual metaphor mapping by ACTUAL technical domain:
- 3D graphics/rendering → translucent geometric solids, ray-traced light beams cutting through crystal prisms, wireframe meshes dissolving into shaded surfaces
- Frontend/CSS/design system → layered colored glass panels, organized color swatches flowing like a river, modular tiles assembling into patterns
- Compiler/build tools → raw ore being smelted into precision parts, caterpillar-to-butterfly metamorphosis, rough stone carved into polished gems
- Architecture/patterns → interlocking clockwork gears, Russian nesting dolls, LEGO-like modular construction
- DevOps/CI/automation → robotic assembly line inspecting products, conveyor belt with quality checkpoints
- Animation/physics → frozen moment of a splash with visible motion trails, time-lapse of a pendulum swing
- Embedded/hardware → microscopic PCB traces glowing with data flow, chip cross-section revealing layered circuits

Return ONLY valid JSON: {"prompt": "你的中文提示词"}`;

/** POST /api/editor/ai/generate-hero — Generate hero image for a post */
export const POST: APIRoute = async ({ request }) => {
  let chatConfig, imageConfig;
  try { chatConfig = getChatConfig(); } catch (err: any) { return json({ error: `Chat: ${err.message}` }, 503); }
  try { imageConfig = getImageGenConfig(); } catch (err: any) { return json({ error: `Image: ${err.message}` }, 503); }

  let body: { slug: string; title: string; description?: string; category?: string; content?: string; size?: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  if (!body.slug || !body.title) return json({ error: 'Missing slug or title' }, 400);

  try {
    // Step 1: LLM generates an optimized image prompt
    const userMessage = [
      `Title: ${body.title}`,
      body.description ? `Description: ${body.description}` : '',
      body.category ? `Category: ${body.category}` : '',
      body.content ? `Content excerpt:\n${body.content.slice(0, 3500)}` : '',
    ].filter(Boolean).join('\n');

    const llmResponse = await completeJSON(chatConfig, [
      { role: 'system', content: PROMPT_SYSTEM },
      { role: 'user', content: userMessage },
    ], { maxTokens: 300, timeout: 15000 });

    const { prompt: imagePrompt } = extractJSON<{ prompt: string }>(llmResponse);

    // Step 2: Generate image with the optimized prompt
    const url = await generateImage(imageConfig, imagePrompt, {
      size: body.size || '3360x1120',
    });

    // Step 3: Download and save to post directory
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error('Failed to download generated image');
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = 'hero-ai.jpg';
    await writeFile(resolve(postsDir, body.slug, filename), buffer);

    return json({ success: true, filename, path: `./${filename}`, prompt: imagePrompt });
  } catch (err: any) {
    if (err.name === 'AbortError') return json({ error: 'Request timed out' }, 504);
    return json({ error: err.message }, 502);
  }
};
