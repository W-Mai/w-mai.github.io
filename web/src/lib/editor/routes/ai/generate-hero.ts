import type { APIRoute } from 'astro';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { json } from '../shared';
import { getChatConfig, getImageGenConfig, completeJSON, extractJSON, generateImage } from '~/lib/editor/ai-client';

export const prerender = false;

const postsDir = resolve(process.cwd(), '..', 'posts');

const STYLE_DESCRIPTIONS: Record<string, string> = {
  flat: '扁平矢量插画风格，简洁几何形状，纯色块填充，无阴影无渐变，粗线条边缘，像 Notion/Linear 的现代科技博客配图，干净利落的平面设计感',
  isometric: '等距2.5D轴测视角，45度俯视的精致立体小场景，像乐高积木或微缩模型搭建的世界，每个物体都有清晰的三面体积感，柔和的投影',
  gradient: '大面积柔和渐变背景配合简洁几何形状（圆形、波浪曲线、光晕），像 Stripe/Vercel 官网的高级感视觉设计，色彩过渡丝滑，有玻璃质感的透明层叠',
  line: '极简单色或双色线条艺术，细线勾勒轮廓，大量留白，像建筑蓝图或技术手稿的精致线描风格，偶尔用一个强调色点缀',
  soft3d: '柔和光影的3D渲染物体，磨砂哑光材质，圆润的边缘，像 Apple 官网产品图的柔和质感，浅景深，干净的纯色背景',
  pixel: '复古像素画风格，8-bit/16-bit 色彩，清晰的像素网格，像经典游戏画面的怀旧感，鲜艳但有限的调色板',
  paper: '剪纸/折纸层叠效果，可见的纸张纹理和厚度，每一层有微妙的投影，像手工纸艺作品的温暖质感，柔和的自然光照',
  lowpoly: '低多边形风格，三角面片构成的场景，可见的几何棱角和面片色差，像水晶切面一样的折射感，冷色调为主',
};

const PROMPT_SYSTEM = `You are a senior visual designer specializing in Seedream/Midjourney text-to-image prompts for technical blog cover images.

Your job: Given a blog article, generate a DETAILED, VIVID Chinese prompt that will produce a stunning 3:1 banner image.

## Prompt Structure (MUST follow this order, each part on its own):

1. **主体场景** (40%): What is the main visual? Describe specific objects, their arrangement, and spatial relationships
2. **构图与视角** (15%): Camera angle, framing, depth of field, foreground/background layers
3. **色彩方案** (15%): Specific color names (not just "warm/cool"), color relationships, gradients
4. **光影氛围** (15%): Light source direction, intensity, shadows, reflections, glow effects
5. **材质纹理** (10%): Surface qualities — matte, glossy, translucent, metallic, fabric, etc.
6. **风格修饰** (5%): Overall artistic style keywords to reinforce the look

## Rules:
- Write in Chinese, use natural flowing sentences
- Be SPECIFIC: "三个半透明的蓝紫色玻璃立方体悬浮在空中，内部可见精密的齿轮结构" >> "一些几何体"
- MUST be 150-400 characters — too short = generic boring image = waste of money (¥0.2/image!)
- Each of the 6 sections above MUST have at least one specific detail sentence
- NO text/letters/UI/code/screenshots in the image
- The image should feel like a premium tech magazine editorial illustration
- Understand technical domain from context: "近平面裁切" = 3D CG, "画家算法" = depth sorting, not actual painting

## Few-shot examples:

Article: "Design Token 驱动的样式架构"
→ "一组精心排列的彩色玻璃色板从中央向四周辐射展开，每块色板内嵌着微缩的UI组件剪影，色板之间有细金线连接形成网络，背景是柔和的奶白色渐变，顶部有棱镜将白光折射成彩虹光谱洒落在色板上，整体呈现精密而优雅的系统感，扁平矢量插画风格"

Article: "一个3D渲染器的三次重写"
→ "三层半透明的玻璃平台从左到右依次升高，第一层是粗糙的线框网格，第二层是带有基础着色的多边形面片，第三层是光滑的全局光照渲染球体反射着周围环境，每层之间有发光的粒子流连接，冷蓝到暖橙的渐变背景，电影级体积光从右上方射入，柔和3D渲染风格"

Article: "Bun Plugin 编译时模板转换"
→ "一块粗糙的原始矿石从左侧进入画面，经过中央一台精密的黄铜蒸汽朋克风格机器的加工，右侧输出一颗完美切割的钻石散发着彩虹光芒，机器内部可见转动的齿轮和发光的管道，深灰背景上有淡淡的蓝图网格线，定向暖光从机器内部透出，等距2.5D视角"

Return ONLY valid JSON: {"prompt": "你的中文提示词", "filename": "suggested-name.jpg"}`;

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
      contentText ? `Content:\n${contentText.slice(0, 1500)}` : '',
    ].filter(Boolean).join('\n');

    try {
      const result = await completeJSON(config, [
        { role: 'system', content: PROMPT_SYSTEM },
        { role: 'user', content: userMessage },
      ], { maxTokens: 500, timeout: 60000 });
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
