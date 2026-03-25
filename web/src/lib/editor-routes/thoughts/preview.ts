import type { APIRoute } from 'astro';
import { renderMarkdown } from '~/lib/markdown/markdown';

export const prerender = false;

/** POST: render markdown content to HTML for live preview */
export const POST: APIRoute = async ({ request }) => {
  const { content } = await request.json();
  if (typeof content !== 'string') {
    return new Response(JSON.stringify({ error: 'content is required' }), { status: 400 });
  }
  const html = await renderMarkdown(content);
  return new Response(JSON.stringify({ html }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
