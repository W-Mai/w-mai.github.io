import type { APIRoute } from 'astro';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

export const prerender = false;

const execFileAsync = promisify(execFile);
const repoRoot = resolve(process.cwd(), '..');

/** Commit message template matching project convention */
function commitMsg(title: string): string {
  return `📝(post): add "${title}"`;
}

/** Run git command in repo root */
async function git(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
  return stdout.trim();
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

/** Collect untracked/modified post files, grouped by slug */
async function collectPendingPosts(): Promise<{ slug: string; title: string; files: string[] }[]> {
  const statusOut = await git('status', '--porcelain', '--', 'posts/');
  if (!statusOut) return [];

  const lines = statusOut.split('\n').filter(Boolean);
  const slugMap = new Map<string, Set<string>>();

  for (const line of lines) {
    const filePath = line.slice(3).trim();
    // Match posts/<slug>.mdx or posts/assets/<name>
    const mdxMatch = filePath.match(/^posts\/([^/]+)\.mdx$/);
    if (mdxMatch) {
      const slug = mdxMatch[1];
      if (!slugMap.has(slug)) slugMap.set(slug, new Set());
      slugMap.get(slug)!.add(filePath);
    }
  }

  // For each slug, find referenced assets that are also pending
  const pendingFiles = new Set(lines.map((l) => l.slice(3).trim()));
  const results: { slug: string; title: string; files: string[] }[] = [];

  for (const [slug, files] of slugMap) {
    const mdxPath = resolve(repoRoot, `posts/${slug}.mdx`);
    let title = slug;
    try {
      const content = await readFile(mdxPath, 'utf-8');
      title = extractTitle(content);
      // Find referenced assets in the content
      const assetRe = /\.\/assets\/([^\s)'"]+)/g;
      let m: RegExpExecArray | null;
      while ((m = assetRe.exec(content))) {
        const assetPath = `posts/assets/${m[1]}`;
        if (pendingFiles.has(assetPath)) files.add(assetPath);
      }
    } catch {}
    results.push({ slug, title, files: [...files] });
  }

  return results;
}

/** GET /api/editor/git — list pending posts to commit */
export const GET: APIRoute = async () => {
  try {
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
      await git('add', ...post.files);
      const msg = messages?.[post.slug] || commitMsg(post.title);
      await git('commit', '-m', msg);
      const hash = await git('rev-parse', '--short', 'HEAD');
      committed.push({ slug: post.slug, title: post.title, hash });
    }

    return json({ committed });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
