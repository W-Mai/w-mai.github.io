import type { APIRoute } from 'astro';
import { json } from '../shared';
import { getChatConfig, completeJSON, extractJSON } from '~/lib/editor/ai-client';

export const prerender = false;

const SYSTEM_PROMPT = `You are a metadata assistant for a technical blog.
Given the article content and existing tags, generate a title, description, tags, and category.

Rules:
- title: concise Chinese title, can include English technical terms. Use colon for subtitle (e.g. "主标题：副标题")
- description: one sentence summary in Chinese, under 80 characters
- tags: 3-6 lowercase kebab-case English tags describing concrete topics (e.g. "astro", "design-system", "ci")
- category: pick one that best fits the article from the existing categories provided, or create a new short Chinese category if none fit
- Reuse existing tags when they genuinely match; create new ones for uncovered topics
- Return ONLY valid JSON: {"title": "...", "description": "...", "tags": ["tag1", "tag2"], "category": "..."}
- No explanation, no markdown, just the JSON object`;

/** POST /api/editor/suggest-meta — AI suggest title, description, tags, category */
export const POST: APIRoute = async ({ request }) => {
  let config;
  try { config = getChatConfig(); } catch (err: any) { return json({ error: err.message }, 503); }

  let body: { content: string; existingTags?: string[]; existingCategories?: string[] };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  if (!body.content?.trim()) return json({ error: 'Missing content' }, 400);

  const userMessage = `Existing tags in the blog:\n${
    (body.existingTags || []).join(', ') || '(none yet)'
  }\n\nExisting categories:\n${
    (body.existingCategories || []).join(', ') || '(none yet)'
  }\n\nArticle content (first 3000 chars):\n${body.content.slice(0, 3000)}`;

  try {
    const content = await completeJSON(config, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ], { maxTokens: 256, timeout: 20000 });
    const parsed = extractJSON<{ title?: string; description?: string; tags?: string[]; category?: string }>(content);
    return json({
      title: parsed.title || '',
      description: parsed.description || '',
      tags: parsed.tags || [],
      category: parsed.category || '',
    });
  } catch (err: any) {
    if (err.name === 'AbortError') return json({ error: 'AI request timed out (20s)' }, 504);
    return json({ error: err.message }, 502);
  }
};
