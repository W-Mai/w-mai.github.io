import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';

export const prerender = false;

function getRepoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
}

function git(...args: string[]): string {
  const root = getRepoRoot();
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).replace(/\s+$/, '');
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** GET /api/editor/thoughts-git — list pending thought changes */
export const GET: APIRoute = async () => {
  try {
    const statusOut = git('status', '--porcelain', '--', 'thoughts/');
    if (!statusOut) return json({ pending: [] });

    const lines = statusOut.split('\n').filter(Boolean);
    const pending = lines.map(line => {
      const xy = line.slice(0, 2);
      const file = line.slice(3).trim();
      const action = xy.includes('D') ? 'delete' : (xy.includes('?') || xy.includes('A')) ? 'add' : 'update';
      return { file, action };
    });

    return json({ pending });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

/** POST /api/editor/thoughts-git — commit all pending thought changes */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const message: string = body.message || '';

    const statusOut = git('status', '--porcelain', '--', 'thoughts/');
    if (!statusOut) return json({ error: 'Nothing to commit' }, 400);

    const lines = statusOut.split('\n').filter(Boolean);
    const files = lines.map(l => l.slice(3).trim());

    // Detect action summary
    const adds = lines.filter(l => l.startsWith('??') || l.startsWith('A ')).length;
    const mods = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
    const dels = lines.filter(l => l.includes('D')).length;

    const parts: string[] = [];
    if (adds) parts.push(`add ${adds}`);
    if (mods) parts.push(`update ${mods}`);
    if (dels) parts.push(`delete ${dels}`);

    const defaultMsg = `🧠(thoughts): ${parts.join(', ')} thought${files.length > 1 ? 's' : ''}`;
    const commitMsg = message || defaultMsg;

    git('add', '--', 'thoughts/');
    git('commit', '-m', commitMsg);
    const hash = git('rev-parse', '--short', 'HEAD');

    return json({ success: true, hash, message: commitMsg, files: files.length });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
