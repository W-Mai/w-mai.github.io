import type { APIRoute } from 'astro';
import { getPendingFiles, commitDirectory, json } from '../../editor-git';

export const prerender = false;

/** GET /api/editor/thoughts-git — list pending thought changes */
export const GET: APIRoute = async () => {
  try {
    const pending = getPendingFiles('thoughts');
    return json({ pending });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

/** POST /api/editor/thoughts-git — commit all pending thought changes */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const result = commitDirectory('thoughts', {
      scope: 'thoughts',
      emoji: '🧠',
      noun: 'thought',
      message: body.message || undefined,
    });
    return json({ success: true, ...result });
  } catch (err: any) {
    const status = err.message === 'Nothing to commit' ? 400 : 500;
    return json({ error: err.message }, status);
  }
};
