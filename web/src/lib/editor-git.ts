import { execFileSync } from 'node:child_process';

/** Resolve repo root via git */
export function getRepoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
}

/** Run git command in repo root */
export function git(...args: string[]): string {
  const root = getRepoRoot();
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf-8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).replace(/\s+$/, '');
}

/** JSON response helper */
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export type GitAction = 'add' | 'update' | 'delete';

/** Map porcelain status code to action verb */
export function statusAction(line: string): GitAction {
  const xy = line.slice(0, 2);
  if (xy.includes('D')) return 'delete';
  if (xy.includes('?') || xy.includes('A')) return 'add';
  return 'update';
}

/** Get pending file changes under a directory path */
export function getPendingFiles(dirPath: string): { file: string; action: GitAction }[] {
  const statusOut = git('status', '--porcelain', '--', dirPath);
  if (!statusOut) return [];
  return statusOut.split('\n').filter(Boolean).map(line => ({
    file: line.slice(3).trim(),
    action: statusAction(line),
  }));
}

/** Summarize actions into a human-readable string */
export function summarizeActions(items: { action: GitAction }[]): string {
  const adds = items.filter(i => i.action === 'add').length;
  const mods = items.filter(i => i.action === 'update').length;
  const dels = items.filter(i => i.action === 'delete').length;
  const parts: string[] = [];
  if (adds) parts.push(`add ${adds}`);
  if (mods) parts.push(`update ${mods}`);
  if (dels) parts.push(`delete ${dels}`);
  return parts.join(', ');
}

/** Commit all changes under a directory with auto-generated or custom message */
export function commitDirectory(dirPath: string, opts: {
  scope: string;
  emoji: string;
  noun: string;
  message?: string;
}): { hash: string; message: string; files: number } {
  const pending = getPendingFiles(dirPath);
  if (pending.length === 0) throw new Error('Nothing to commit');

  const summary = summarizeActions(pending);
  const plural = pending.length > 1 ? `${opts.noun}s` : opts.noun;
  const commitMsg = opts.message || `${opts.emoji}(${opts.scope}): ${summary} ${plural}`;

  git('add', '--', `${dirPath}/`);
  git('commit', '-m', commitMsg);
  const hash = git('rev-parse', '--short', 'HEAD');

  return { hash, message: commitMsg, files: pending.length };
}
