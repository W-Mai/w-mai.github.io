import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { git, getRepoRoot, statusAction, json } from '../../git';

export const prerender = false;

/** Extract title from MDX frontmatter */
function extractTitle(content: string): string {
  const m = content.match(/^---[\s\S]*?title:\s*['"](.+?)['"][\s\S]*?---/m);
  return m?.[1] || 'Untitled';
}

/** Collect untracked/modified post files, grouped by slug */
async function collectPendingPosts(): Promise<{ slug: string; title: string; files: string[]; action: 'add' | 'update' | 'delete' }[]> {
  const statusOut = git('status', '--porcelain', '--', 'posts/');
  if (!statusOut) return [];

  const lines = statusOut.split('\n').filter(Boolean);
  const slugMap = new Map<string, { files: Set<string>; action: 'add' | 'update' | 'delete' }>();

  for (const line of lines) {
    const filePath = line.slice(3).trim();
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
      const dirPath = `posts/${slug}/`;
      let diff: string;
      try {
        diff = git('-c', 'color.diff=false', 'diff', '--', dirPath);
      } catch {
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
      const msg = messages?.[post.slug] || `📝(post): ${post.action} "${post.title}"`;
      git('commit', '-m', msg);
      const hash = git('rev-parse', '--short', 'HEAD');
      committed.push({ slug: post.slug, title: post.title, hash });
    }

    return json({ committed });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
