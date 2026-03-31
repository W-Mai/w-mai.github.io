/**
 * AI client abstraction for editor features.
 * Provides chat (streaming), structured JSON completion, and vision capabilities.
 * All AI route handlers should use this client instead of calling APIs directly.
 */

/** AI provider configuration */
export interface AIProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Chat message format */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

/** Multimodal content part (text or image) */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** Read OpenAI-compatible API config from environment variables. */
export function getChatConfig(): AIProviderConfig {
  const baseUrl = import.meta.env.OPENAI_API_BASE || process.env.OPENAI_API_BASE;
  const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model = import.meta.env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!baseUrl) throw new Error('OPENAI_API_BASE is not configured');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

/** Read vision API config (Volcengine / doubao). */
export function getVisionConfig(): AIProviderConfig {
  const apiKey = import.meta.env.ARK_API_KEY || process.env.ARK_API_KEY;
  if (!apiKey) throw new Error('ARK_API_KEY is not configured');
  return {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey,
    model: 'doubao-seed-2-0-lite-260215',
  };
}

/** Non-streaming JSON completion. Returns parsed response content string. */
export async function completeJSON(
  config: AIProviderConfig,
  messages: ChatMessage[],
  opts: { maxTokens?: number; timeout?: number } = {},
): Promise<string> {
  const { maxTokens = 256, timeout = 20000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`AI API error (${res.status}): ${errText}`);
    }
    const result = await res.json();
    return result.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a JSON object from AI response content. Throws on failure. */
export function extractJSON<T = Record<string, unknown>>(content: string): T {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in AI response');
  return JSON.parse(match[0]);
}

/** Streaming SSE completion. Returns a ReadableStream of SSE events. */
export async function completeStream(
  config: AIProviderConfig,
  messages: ChatMessage[],
  opts: { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 30000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, messages, stream: true }),
    signal: controller.signal,
  });

  clearTimeout(timer);

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`AI API error (${res.status}): ${errText}`);
  }
  if (!res.body) throw new Error('No response body from AI API');

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
            } catch { /* skip malformed chunks */ }
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
}

/** Read image generation API config (Volcengine Seedream). */
export function getImageGenConfig(): AIProviderConfig {
  const apiKey = import.meta.env.ARK_API_KEY || process.env.ARK_API_KEY;
  if (!apiKey) throw new Error('ARK_API_KEY is not configured');
  return {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey,
    model: 'doubao-seedream-5-0-260128',
  };
}

/** Generate an image from a text prompt. Returns the image URL. */
export async function generateImage(
  config: AIProviderConfig,
  prompt: string,
  opts: { size?: string; timeout?: number } = {},
): Promise<string> {
  const { size = '2K', timeout = 60000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${config.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        size,
        sequential_image_generation: 'disabled',
        response_format: 'url',
        stream: false,
        watermark: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Image API error (${res.status}): ${errText}`);
    }
    const result = await res.json();
    const url = result.data?.[0]?.url;
    if (!url) throw new Error('No image URL in response');
    return url;
  } finally {
    clearTimeout(timer);
  }
}
