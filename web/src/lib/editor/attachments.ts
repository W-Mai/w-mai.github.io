import type { AttachmentInfo, AttachmentScope } from '~/types/editor-api';
export type { AttachmentScope } from '~/types/editor-api';

const API_URL = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/') + 'api/editor/attachments';
const GLOBAL_SCOPE: AttachmentScope = { kind: 'global' };

interface CacheEntry {
  items?: AttachmentInfo[];
  pending?: Promise<AttachmentInfo[]>;
}
const cache = new Map<string, CacheEntry>();

/** Discard every scope, including in-flight snapshots, after a mutation. */
export function invalidateAttachmentCache(): void {
  cache.clear();
}

function queryFor(scope: AttachmentScope): URLSearchParams {
  const query = new URLSearchParams({ scope: scope.kind });
  if (scope.kind === 'post') query.set('slug', scope.slug);
  return query;
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(data?.error || '附件请求失败'), { status: response.status });
  }
  return data as T;
}

/** Share listings only between consumers of the same scope. */
export function loadEditorAttachments(refresh = false, scope: AttachmentScope = GLOBAL_SCOPE): Promise<AttachmentInfo[]> {
  const query = queryFor(scope);
  const key = query.toString();
  if (refresh) cache.delete(key);
  const entry = cache.get(key) ?? {};
  if (entry.items) return Promise.resolve(entry.items);
  if (entry.pending) return entry.pending;
  cache.set(key, entry);
  const request = fetch(`${API_URL}?${query}`, { cache: 'no-store' })
    .then(readResponse<AttachmentInfo[]>)
    .then((items) => {
      if (cache.get(key) === entry) entry.items = items;
      return items;
    })
    .finally(() => {
      if (cache.get(key) === entry) entry.pending = undefined;
    });
  entry.pending = request;
  return request;
}

/** Send the raw body so the server enforces the limit while streaming. */
export async function uploadEditorAttachment(group: string, file: File, scope: AttachmentScope = GLOBAL_SCOPE): Promise<AttachmentInfo> {
  const query = queryFor(scope);
  query.set('group', group);
  query.set('name', file.name);
  const response = await fetch(`${API_URL}?${query}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file,
  });
  const attachment = await readResponse<AttachmentInfo>(response);
  invalidateAttachmentCache();
  return attachment;
}

export async function renameEditorAttachment(id: string, name: string, scope: AttachmentScope = GLOBAL_SCOPE): Promise<AttachmentInfo> {
  const response = await fetch(`${API_URL}?${queryFor(scope)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }),
  });
  const attachment = await readResponse<AttachmentInfo>(response);
  invalidateAttachmentCache();
  return attachment;
}

export async function replaceEditorAttachment(id: string, file: File, scope: AttachmentScope = GLOBAL_SCOPE): Promise<AttachmentInfo> {
  const query = queryFor(scope);
  query.set('id', id);
  const response = await fetch(`${API_URL}?${query}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file,
  });
  const attachment = await readResponse<AttachmentInfo>(response);
  invalidateAttachmentCache();
  return attachment;
}

export async function deleteEditorAttachment(id: string, scope: AttachmentScope = GLOBAL_SCOPE): Promise<void> {
  const query = queryFor(scope);
  query.set('id', id);
  await readResponse<{ success: true }>(await fetch(`${API_URL}?${query}`, { method: 'DELETE' }));
  invalidateAttachmentCache();
}

/** Escape Markdown/MDX punctuation while preserving the author's link label. */
export function attachmentMarkdownLink(attachment: AttachmentInfo, label = attachment.name): string {
  const text = label.replace(/[\r\n]+/g, ' ').replace(/[\\[\]\x60*_{}<>!$&]/g, '\\$&');
  return '[' + text + '](' + attachment.reference + ')';
}
