import type { APIRoute } from 'astro';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Read AI config from environment variables */
function getAIConfig() {
  const baseUrl = import.meta.env.OPENAI_API_BASE || process.env.OPENAI_API_BASE;
  const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model = import.meta.env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!baseUrl) throw new Error('OPENAI_API_BASE is not configured');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

const SYSTEM_PROMPT = `You are a tag and mood suggestion assistant for a personal thought/microblog system.
Given the thought content and a list of existing tags already used in the system, suggest 2-5 relevant tags AND one mood emoji.

Rules:
- Reuse an existing tag ONLY when it genuinely matches the content's topic — do NOT force-fit unrelated tags just because they exist
- Create new tags when the content covers a topic not represented by existing tags
- Each tag should describe a concrete topic (e.g. 美食, 拔牙, 追剧, CSS), not a vague mood or feeling
- Tags should be short (1-3 words), Chinese or English
- Always suggest at least 2 tags to provide useful categorization
- Do NOT default to mood/emotion tags (like 发疯, 开心) unless the content is genuinely about that emotion as a topic
- For mood, pick ONE emoji from this list that best matches the overall vibe: 🎉 🤔 ✨ 😤 🐛 💡 🔥 😂 🥲 👀
- Return ONLY valid JSON: {"tags": ["标签1", "tag2"], "mood": "🤔"}
- No explanation, no markdown, just the JSON object`;

/** POST /api/editor/thoughts/suggest-tags — AI suggest tags for thought content */
export const POST: APIRoute = async ({ request }) => {
  let config;
  try {
    config = getAIConfig();
  } catch (err: any) {
    return json({ error: err.message }, 503);
  }

  let body: { content: string; existingTags: string[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.content?.trim()) return json({ error: 'Missing content' }, 400);

  const userMessage = `Existing tags in the system (tag: usage count):\n${
    (body.existingTags || []).map(t => t).join(', ') || '(none yet)'
  }\n\nThought content:\n${body.content}\n\nRemember: suggest tags based on the ACTUAL TOPIC of the content, not based on which existing tags are most common.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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
        max_tokens: 128,
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
    if (!objMatch) {
      return json({ error: 'Failed to parse AI response', raw: content }, 502);
    }

    const parsed: { tags: string[]; mood?: string } = JSON.parse(objMatch[0]);
    return json({ tags: parsed.tags || [], mood: parsed.mood || '' });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return json({ error: 'AI request timed out (15s)' }, 504);
    }
    return json({ error: `AI request failed: ${err.message}` }, 502);
  }
};
