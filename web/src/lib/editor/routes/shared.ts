/** Shared utilities for editor API route handlers. */

/** Create a JSON Response with the given data and status code. */
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Read OpenAI-compatible API config from environment variables. */
export function getAIConfig() {
  const baseUrl = import.meta.env.OPENAI_API_BASE || process.env.OPENAI_API_BASE;
  const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model = import.meta.env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!baseUrl) throw new Error('OPENAI_API_BASE is not configured');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}
