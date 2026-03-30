import type { APIRoute } from 'astro';
import { json } from '../shared';
import { getChatConfig, completeStream } from '~/lib/editor/ai-client';

export const prerender = false;

/** System prompts per action type */
const AI_PROMPTS: Record<string, string> = {
  polish: 'Improve the readability and grammar of the following text. Keep the same meaning and tone. Return only the improved text without explanation.',
  simplify: 'Make the following text more concise while preserving the key information. Return only the simplified text without explanation.',
  expand: 'Add more detail and explanation to the following text. Return only the expanded text without explanation.',
  translate: 'Translate the following text to {language}. Preserve formatting. Return only the translated text without explanation.',
  'suggest-slugs': 'Translate the given title (which may be in any language, e.g. Chinese) into 3 meaningful English URL-friendly slugs. Rules: use lowercase English words, hyphen-separated, concise but descriptive, max 80 chars each. The slugs should accurately convey the meaning of the original title in English. Return ONLY a JSON array of strings, e.g. ["todays-encounter","my-experience-today","what-happened-today"]. No explanation.',
  'suggest-asset-name': 'Given the original filename (which may contain non-English characters), suggest 3 meaningful English filenames. Rules: lowercase, use hyphens or underscores, keep the original file extension, concise but descriptive, max 60 chars. The names should convey the meaning of the original name in English. Return ONLY a JSON array of strings, e.g. ["hero-banner.png","main-cover.png","top-image.png"]. No explanation.',
  'suggest-commit-msg': 'You are a git commit message writer. Given a blog post title, the action (add/update/delete), and a git diff, generate a commit message following this exact format:\n\n😁(scope): description\n\nRules:\n- First line: emoji + (scope) + colon + space + short description in English\n- The emoji should be contextual (📝 for content, 🐛 for fix, ✨ for new feature, etc.)\n- scope is usually "post" for blog posts\n- description should be concise, lowercase start, no period\n- If the diff is substantial, add a blank line then 1-2 sentence body explaining what changed\n- Return ONLY the commit message, no quotes, no explanation.',
};

/** POST /api/editor/ai — AI proxy with SSE streaming */
export const POST: APIRoute = async ({ request }) => {
  let config;
  try { config = getChatConfig(); } catch (err: any) { return json({ error: err.message }, 503); }

  let body: { action: string; content: string; context?: string; language?: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { action, content, context, language } = body;
  if (!action || content == null) return json({ error: 'Missing required fields: action, content' }, 400);
  if (content === '') return json({ ok: true });

  let systemPrompt = AI_PROMPTS[action];
  if (!systemPrompt) return json({ error: `Unknown action: ${action}` }, 400);

  if (action === 'translate' && language) {
    systemPrompt = systemPrompt.replace('{language}', language);
  }

  const userMessage = context ? `Context:\n${context}\n\nText to process:\n${content}` : content;

  try {
    return await completeStream(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);
  } catch (err: any) {
    if (err.name === 'AbortError') return json({ error: 'AI request timed out (30s)' }, 504);
    return json({ error: err.message }, 502);
  }
};
