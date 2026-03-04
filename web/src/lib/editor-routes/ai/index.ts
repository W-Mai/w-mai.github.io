import type { APIRoute } from 'astro';

export const prerender = false;

/** System prompts per action type */
const AI_PROMPTS: Record<string, string> = {
  polish: 'Improve the readability and grammar of the following text. Keep the same meaning and tone. Return only the improved text without explanation.',
  simplify: 'Make the following text more concise while preserving the key information. Return only the simplified text without explanation.',
  expand: 'Add more detail and explanation to the following text. Return only the expanded text without explanation.',
  translate: 'Translate the following text to {language}. Preserve formatting. Return only the translated text without explanation.',
  'suggest-slugs': 'Translate the given title (which may be in any language, e.g. Chinese) into 3 meaningful English URL-friendly slugs. Rules: use lowercase English words, hyphen-separated, concise but descriptive, max 80 chars each. The slugs should accurately convey the meaning of the original title in English. Return ONLY a JSON array of strings, e.g. ["todays-encounter","my-experience-today","what-happened-today"]. No explanation.',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Read AI config from environment variables */
function getAIConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = import.meta.env.OPENAI_API_BASE || process.env.OPENAI_API_BASE;
  const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!baseUrl) throw new Error('OPENAI_API_BASE environment variable is not configured');
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not configured');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

/** POST /api/editor/ai — AI proxy with SSE streaming */
export const POST: APIRoute = async ({ request }) => {
  let config: { baseUrl: string; apiKey: string };
  try {
    config = getAIConfig();
  } catch (err: any) {
    return json({ error: err.message }, 503);
  }

  let body: { action: string; content: string; context?: string; language?: string; currentSlug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action, content, context, language } = body;
  if (!action || !content) {
    return json({ error: 'Missing required fields: action, content' }, 400);
  }

  let systemPrompt = AI_PROMPTS[action];
  if (!systemPrompt) {
    return json({ error: `Unknown action: ${action}` }, 400);
  }

  // Replace language placeholder for translate action
  if (action === 'translate' && language) {
    systemPrompt = systemPrompt.replace('{language}', language);
  }

  const userMessage = context ? `Context:\n${context}\n\nText to process:\n${content}` : content;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return json({ error: `AI API error: ${errText}` }, res.status >= 500 ? 502 : res.status);
    }

    if (!res.body) {
      return json({ error: 'No response body from AI API' }, 502);
    }

    // Stream SSE response
    const stream = new ReadableStream({
      async start(ctrl) {
        const encoder = new TextEncoder();
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResult = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const chunk = parsed.choices?.[0]?.delta?.content;
                if (chunk) {
                  fullResult += chunk;
                  ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }

          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: fullResult })}\n\n`));
        } catch (err: any) {
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        } finally {
          ctrl.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return json({ error: 'AI request timed out (30s)' }, 504);
    }
    return json({ error: `AI request failed: ${err.message}` }, 502);
  }
};
