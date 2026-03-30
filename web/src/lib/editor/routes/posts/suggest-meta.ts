import type { APIRoute } from 'astro';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getAIConfig() {
  const baseUrl = import.meta.env.OPENAI_API_BASE || process.env.OPENAI_API_BASE;
  const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model = import.meta.env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!baseUrl) throw new Error('OPENAI_API_BASE is not configured');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

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

/** POST /api/editor/posts/suggest-meta — AI suggest title, description, tags */
export const POST: APIRoute = async ({ request }) => {
  let config;
  try {
    config = getAIConfig();
  } catch (err: any) {
    return json({ error: err.message }, 503);
  }

  let body: { content: string; existingTags?: string[]; existingCategories?: string[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.content?.trim()) return json({ error: 'Missing content' }, 400);

  const userMessage = `Existing tags in the blog:\n${
    (body.existingTags || []).join(', ') || '(none yet)'
  }\n\nExisting categories:\n${
    (body.existingCategories || []).join(', ') || '(none yet)'
  }\n\nArticle content (first 3000 chars):\n${body.content.slice(0, 3000)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 256,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return json({ error: `AI API error: ${errText}` }, 502);
    }

    const result = await res.json();
    const content = result.choices?.[0]?.message?.content || '';

    const objMatch = content.match(/\{[\s\S]*\}/);
    if (!objMatch) return json({ error: 'Failed to parse AI response', raw: content }, 502);

    const parsed: { title?: string; description?: string; tags?: string[]; category?: string } = JSON.parse(objMatch[0]);
    return json({
      title: parsed.title || '',
      description: parsed.description || '',
      tags: parsed.tags || [],
      category: parsed.category || '',
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') return json({ error: 'AI request timed out (20s)' }, 504);
    return json({ error: `AI request failed: ${err.message}` }, 502);
  }
};
