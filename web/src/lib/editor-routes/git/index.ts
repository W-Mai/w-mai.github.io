import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const prerender = false;

/** Resolve repo root via git */
function getRepoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
}

/** Commit message template matching project convention */
function commitMsg(title: string, action: 'add' | 'update' | 'delete'): string {
  return `📝(post): ${action} "${title}"`;
}

/** Run git command in repo root (trims trailing whitespace only) */
function git(...args: string[]): string {
  const root = getRepoRoot();
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).replace(/\s+$/, '');
}

/** Extract title from MDX frontmatter */
function extractTitle(content: string): string {
  const m = content.match(/^---[\s\S]*?title:\s*['"](.+?)['"][\s\S]*?---/m);
  return m?.[1] || 'Untitled';
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Map porcelain status code to action verb */
function statusAction(line: string): 'add' | 'update' | 'delete' {
  const xy = line.slice(0, 2);
  if (xy.includes('D')) return 'delete';
  if (xy.includes('?') || xy.includes('A')) return 'add';
  return 'update';
}

/** Collect untracked/modified post files, grouped by slug */
async function collectPendingPosts(): Promise<{ slug: string; title: string; files: string[]; action: 'add' | 'update' | 'delete' }[]> {
  const statusOut = git('status', '--porcelain', '--', 'posts/');
  if (!statusOut) return [];

  const lines = statusOut.split('\n').filter(Boolean);
  const slugMap = new Map<string, { files: Set<string>; action: 'add' | 'update' | 'delete' }>();

  for (const line of lines) {
    const filePath = line.slice(3).trim();
    // Match posts/<slug>/index.mdx or posts/<slug>/<asset>
    const dirMatch = filePath.match(/^posts\/([^/]+)\//);
    if (dirMatch) {
      const slug = dirMatch[1];
      if (!slugMap.has(slug)) slugMap.set(slug, { files: new Set(), action: statusAction(line) });
      slugMap.get(slug)!.files.add(filePath);
    }
  }

  const results: { slug: string; title: string; files: string[]; action: 'add' | 'update' | 'delete' }[] = [];

  for (const [slug, { files, action }] of slugMap) {
    const mdxPath = resolve(getRepoRoot(), `posts/${slug}/index.mdx`);
    let title = slug;
    try {
      const content = await readFile(mdxPath, 'utf-8');
      title = extractTitle(content);
    } catch {}
    results.push({ slug, title, files: [...files], action });
  }

  return results;
}

/** GET /api/editor/git — list pending posts or get diff for a slug */
export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = url.searchParams.get('diff');
    if (slug) {
      // Return diff for a specific post directory
      const dirPath = `posts/${slug}/`;
      let diff: string;
      try {
        diff = git('-c', 'color.diff=false', 'diff', '--', dirPath);
      } catch {
        // Untracked directory — show full content as diff
        diff = git('-c', 'color.diff=false', 'diff', '--no-index', '/dev/null', `posts/${slug}/index.mdx`);
      }
      return json({ slug, diff });
    }
    const pending = await collectPendingPosts();
    return json({ pending });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};

/** POST /api/editor/git — commit pending posts one by one */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const slugs: string[] | undefined = body.slugs;
    const messages: Record<string, string> | undefined = body.messages;

    let pending = await collectPendingPosts();
    if (slugs?.length) {
      const set = new Set(slugs);
      pending = pending.filter((p) => set.has(p.slug));
    }

    if (pending.length === 0) return json({ committed: [] });

    const committed: { slug: string; title: string; hash: string }[] = [];

    for (const post of pending) {
      git('add', ...post.files);
      const msg = messages?.[post.slug] || commitMsg(post.title, post.action);
      git('commit', '-m', msg);
      const hash = git('rev-parse', '--short', 'HEAD');
      committed.push({ slug: post.slug, title: post.title, hash });
    }

    return json({ committed });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
