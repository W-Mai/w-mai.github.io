import type { APIRoute } from 'astro';
import { json } from '../shared';
import { getChatConfig, completeJSON, extractJSON } from '~/lib/editor/ai-client';

export const prerender = false;

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

/** POST /api/editor/suggest-thought-tags — AI suggest tags for thought content */
export const POST: APIRoute = async ({ request }) => {
  let config;
  try { config = getChatConfig(); } catch (err: any) { return json({ error: err.message }, 503); }

  let body: { content: string; existingTags: string[] };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  if (!body.content?.trim()) return json({ error: 'Missing content' }, 400);

  const userMessage = `Existing tags in the system (tag: usage count):\n${
    (body.existingTags || []).join(', ') || '(none yet)'
  }\n\nThought content:\n${body.content}\n\nRemember: suggest tags based on the ACTUAL TOPIC of the content, not based on which existing tags are most common.`;

  try {
    const content = await completeJSON(config, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ], { maxTokens: 128, timeout: 15000 });
    const parsed = extractJSON<{ tags: string[]; mood?: string }>(content);
    return json({ tags: parsed.tags || [], mood: parsed.mood || '' });
  } catch (err: any) {
    if (err.name === 'AbortError') return json({ error: 'AI request timed out (15s)' }, 504);
    return json({ error: err.message }, 502);
  }
};
