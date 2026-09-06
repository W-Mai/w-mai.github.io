import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, parse, resolve, sep } from 'node:path';
import {
  attachmentReference,
  attachmentUrl,
  parseAttachmentReference,
  validateAttachmentId,
  validateAttachmentScope,
} from './paths';
import type { AttachmentInfo, AttachmentOptions } from './paths';
import { findAttachmentReferences } from './references';

export const MAX_ATTACHMENT_UPLOAD_BYTES = 32 * 1024 * 1024;

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.7z': 'application/x-7z-compressed',
  '.br': 'application/octet-stream',
  '.bz': 'application/x-bzip',
  '.bz2': 'application/x-bzip2',
  '.gz': 'application/gzip',
  '.rar': 'application/vnd.rar',
  '.tar': 'application/x-tar',
  '.tgz': 'application/gzip',
  '.xz': 'application/x-xz',
  '.zip': 'application/zip',
  '.zst': 'application/zstd',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.jsonl': 'application/x-ndjson',
  '.ndjson': 'application/x-ndjson',
  '.md': 'text/markdown',
  '.mdx': 'text/plain',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.c': 'text/plain',
  '.h': 'text/plain',
  '.cc': 'text/plain',
  '.cpp': 'text/plain',
  '.hpp': 'text/plain',
  '.rs': 'text/plain',
  '.rn': 'text/plain',
  '.lua': 'text/plain',
  '.py': 'text/plain',
  '.sh': 'text/plain',
  '.toml': 'text/plain',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/plain',
  '.tsx': 'text/plain',
  '.jsx': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ogv': 'video/ogg',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function attachmentError(message: string, status = 400): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function absoluteDirectory(directory: string): string {
  if (!isAbsolute(directory)) throw attachmentError('Attachment directory must be absolute');
  return resolve(directory);
}

/** Serialize mutations of one root, including those addressed through different scopes. */
const mutations = new Map<string, Promise<void>>();

function mutate<T>(options: AttachmentOptions, operation: () => Promise<T>): Promise<T> {
  const key = absoluteDirectory(options.directory);
  const previous = mutations.get(key) ?? Promise.resolve();
  const result = previous.then(operation);
  const settled = result.then(() => {}, () => {});
  mutations.set(key, settled);
  void settled.then(() => {
    if (mutations.get(key) === settled) mutations.delete(key);
  });
  return result;
}

/** Check each directory component, including parents of a missing root. */
async function ensureDirectory(directory: string, create: boolean): Promise<boolean> {
  const absolute = absoluteDirectory(directory);
  const root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (!hasCode(error, 'ENOENT')) throw error;
      if (!create) return false;
      try { await mkdir(current); } catch (mkdirError) {
        if (!hasCode(mkdirError, 'EEXIST')) throw mkdirError;
      }
      info = await lstat(current);
    }
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw attachmentError('Attachment directory contains a symbolic link or a non-directory component');
    }
  }
  return true;
}

function contentDirectories(options: AttachmentOptions) {
  const repository = resolve(absoluteDirectory(options.directory), '..');
  return {
    postsDirectory: options.postsDirectory ?? join(repository, 'posts'),
    thoughtsDirectory: options.thoughtsDirectory ?? join(repository, 'thoughts'),
  };
}

/** A post scope exists only when a real, non-linked article exists on disk. */
async function scopePrefix(options: AttachmentOptions): Promise<string> {
  const scope = validateAttachmentScope(options.scope ?? { kind: 'global' });
  if (scope.kind === 'global') return '';
  const postDirectory = join(absoluteDirectory(contentDirectories(options).postsDirectory), scope.slug);
  if (!await ensureDirectory(postDirectory, false)) {
    throw attachmentError(`文章不存在：${scope.slug}`, 404);
  }
  let found = false;
  for (const name of ['index.mdx', 'index.md']) {
    let info;
    try { info = await lstat(join(postDirectory, name)); } catch (error) {
      if (hasCode(error, 'ENOENT')) continue;
      throw error;
    }
    if (info.isSymbolicLink() || !info.isFile()) {
      throw attachmentError('Post scope requires a regular article file');
    }
    found = true;
  }
  if (!found) throw attachmentError(`文章不存在：${scope.slug}`, 404);
  return scope.slug;
}

async function scopedId(id: string, options: AttachmentOptions): Promise<string> {
  validateAttachmentId(id);
  const prefix = await scopePrefix(options);
  if (prefix && !id.startsWith(`${prefix}/`)) {
    throw attachmentError('附件不在当前文章作用域内', 403);
  }
  return id;
}

function validateFilename(name: string): string {
  validateAttachmentId(name);
  if (name.includes('/')) throw attachmentError('Attachment name must be one filename');
  return name;
}

/** Return a checked file path; never expose this path in public metadata. */
export async function attachmentFilePath(id: string, directory: string): Promise<string> {
  validateAttachmentId(id);
  const root = absoluteDirectory(directory);
  if (!await ensureDirectory(root, false)) throw attachmentError(`Attachment not found: ${id}`, 404);
  const segments = id.split('/');
  let current = root;
  for (let index = 0; index < segments.length; index++) {
    current = join(current, segments[index]);
    let info;
    try { info = await lstat(current); } catch (error) {
      if (hasCode(error, 'ENOENT')) throw attachmentError(`Attachment not found: ${id}`, 404);
      throw error;
    }
    if (info.isSymbolicLink()) throw attachmentError(`Attachment contains a symbolic link: ${id}`);
    const valid = index === segments.length - 1 ? info.isFile() : info.isDirectory();
    if (!valid) throw attachmentError(`Attachment is not a regular file path: ${id}`);
  }
  return current;
}

function metadata(id: string, size: number, options: AttachmentOptions): AttachmentInfo {
  return {
    id,
    name: id.slice(id.lastIndexOf('/') + 1),
    size,
    mediaType: MEDIA_TYPES[extname(id).toLowerCase()] ?? 'application/octet-stream',
    reference: attachmentReference(id),
    url: attachmentUrl(id, options.base),
  };
}

export async function resolveAttachment(reference: string, options: AttachmentOptions): Promise<AttachmentInfo> {
  const id = parseAttachmentReference(reference);
  if (id === null) throw attachmentError('Expected an attachment: reference');
  await scopedId(id, options);
  const path = await attachmentFilePath(id, options.directory);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw attachmentError(`Attachment is not a regular file: ${id}`);
  return metadata(id, info.size, options);
}

export async function listAttachments(options: AttachmentOptions): Promise<AttachmentInfo[]> {
  const root = absoluteDirectory(options.directory);
  const prefix = await scopePrefix(options);
  const directory = prefix ? join(root, prefix) : root;
  if (!await ensureDirectory(directory, false)) return [];
  const attachments: AttachmentInfo[] = [];
  async function visit(current: string, parentId: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const id = parentId ? `${parentId}/${entry.name}` : entry.name;
      validateAttachmentId(id);
      const path = join(current, entry.name);
      const info = await lstat(path);
      if (info.isSymbolicLink()) throw attachmentError(`Attachment contains a symbolic link: ${id}`);
      if (info.isDirectory()) await visit(path, id);
      else if (info.isFile()) attachments.push(metadata(id, info.size, options));
      else throw attachmentError(`Attachment is not a regular file: ${id}`);
    }
  }
  await visit(directory, prefix);
  return attachments.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

async function removeFiles(paths: string[], error: unknown): Promise<never> {
  const cleanupErrors: unknown[] = [];
  for (const path of paths) {
    try { await unlink(path); } catch (cleanupError) {
      if (!hasCode(cleanupError, 'ENOENT')) cleanupErrors.push(cleanupError);
    }
  }
  if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], 'Attachment cleanup failed');
  throw error;
}

/** Accept bytes into a hidden file; callers publish only after the stream closes. */
async function writeUpload(parent: string, body: ReadableStream<Uint8Array>): Promise<{ path: string; size: number }> {
  let path = '';
  let file: FileHandle | undefined;
  while (true) {
    path = join(parent, `.upload-${randomUUID()}.tmp`);
    try {
      file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
      break;
    } catch (error) {
      if (!hasCode(error, 'EEXIST')) throw error;
    }
  }
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    reader = body.getReader();
    let size = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      if (!(chunk instanceof Uint8Array)) throw attachmentError('Attachment upload must contain bytes');
      if (chunk.byteLength > MAX_ATTACHMENT_UPLOAD_BYTES - size) {
        throw attachmentError('单个附件不能超过 32 MiB', 413);
      }
      size += chunk.byteLength;
      let offset = 0;
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset, null);
        if (bytesWritten === 0) throw new Error('Attachment upload made no write progress');
        offset += bytesWritten;
      }
    }
    await file.close();
    file = undefined;
    return { path, size };
  } catch (error) {
    try { await reader?.cancel(error); } catch { /* Preserve the operation error. */ }
    try { await file?.close(); } catch { /* Still remove the temporary file. */ }
    return removeFiles([path], error);
  } finally {
    reader?.releaseLock();
  }
}

/** Publish a completed inode without replacing any existing directory entry. */
async function publishUpload(temporary: string, parent: string, name: string): Promise<string> {
  const extension = extname(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  for (let number = 0; ; number++) {
    const chosenName = number === 0 ? name : `${stem} (${number})${extension}`;
    const path = join(parent, chosenName);
    if (!await ensureDirectory(parent, false)) throw attachmentError('Attachment upload directory disappeared');
    try {
      await link(temporary, path);
      return chosenName;
    } catch (error) {
      if (!hasCode(error, 'EEXIST')) throw error;
      let existing;
      try { existing = await lstat(path); } catch (statError) {
        if (hasCode(statError, 'ENOENT')) continue;
        throw statError;
      }
      if (existing.isSymbolicLink() || !existing.isFile()) {
        throw attachmentError('Attachment upload target is a symbolic link or a non-regular file');
      }
    }
  }
}

export function storeAttachment(group: string, name: string, body: ReadableStream<Uint8Array>, options: AttachmentOptions): Promise<AttachmentInfo> {
  return mutate(options, async () => {
    if (group !== '') validateAttachmentId(group);
    validateFilename(name);
    const prefix = await scopePrefix(options);
    const parentId = [prefix, group].filter(Boolean).join('/');
    const parent = join(absoluteDirectory(options.directory), ...parentId.split('/').filter(Boolean));
    await ensureDirectory(parent, true);
    const temporary = await writeUpload(parent, body);
    let published: string | undefined;
    try {
      const chosenName = await publishUpload(temporary.path, parent, name);
      published = join(parent, chosenName);
      const id = parentId ? `${parentId}/${chosenName}` : chosenName;
      const info = metadata(id, temporary.size, options);
      await unlink(temporary.path);
      return info;
    } catch (error) {
      return removeFiles(published ? [published, temporary.path] : [temporary.path], error);
    }
  });
}

async function assertUnreferenced(id: string, options: AttachmentOptions): Promise<void> {
  const references = await findAttachmentReferences(id, { ...options, scope: { kind: 'global' } }, contentDirectories(options));
  if (references.length) {
    const locations = references.slice(0, 8).map(({ path, line, column }) => `${path}:${line}:${column}`);
    const remaining = references.length > locations.length ? `；另有 ${references.length - locations.length} 处` : '';
    throw attachmentError(`附件仍被 ${references.length} 处内容引用：${locations.join('；')}${remaining}。请先移除引用，或使用“替换”保持现有链接。`, 409);
  }
}

/** Rename only the basename, preserving the directory and all existing targets. */
export function renameAttachment(id: string, name: string, options: AttachmentOptions): Promise<AttachmentInfo> {
  return mutate(options, async () => {
    await scopedId(id, options);
    validateFilename(name);
    const source = await attachmentFilePath(id, options.directory);
    const targetId = id.includes('/') ? `${id.slice(0, id.lastIndexOf('/'))}/${name}` : name;
    const info = metadata(targetId, (await lstat(source)).size, options);
    if (targetId === id) return info;
    await assertUnreferenced(id, options);
    const target = join(dirname(source), name);
    await attachmentFilePath(id, options.directory);
    try { await link(source, target); } catch (error) {
      if (hasCode(error, 'EEXIST')) throw attachmentError('同目录已存在该文件名', 409);
      throw error;
    }
    try { await unlink(source); } catch (error) { return removeFiles([target], error); }
    return info;
  });
}

/** Atomically replace content while keeping the ID, URL, and existing references. */
export function replaceAttachment(id: string, body: ReadableStream<Uint8Array>, options: AttachmentOptions): Promise<AttachmentInfo> {
  return mutate(options, async () => {
    await scopedId(id, options);
    const source = await attachmentFilePath(id, options.directory);
    const temporary = await writeUpload(dirname(source), body);
    try {
      const info = metadata(id, temporary.size, options);
      await scopedId(id, options);
      await attachmentFilePath(id, options.directory);
      await rename(temporary.path, source);
      return info;
    } catch (error) {
      return removeFiles([temporary.path], error);
    }
  });
}

export function deleteAttachment(id: string, options: AttachmentOptions): Promise<void> {
  return mutate(options, async () => {
    await scopedId(id, options);
    const source = await attachmentFilePath(id, options.directory);
    await assertUnreferenced(id, options);
    await attachmentFilePath(id, options.directory);
    await unlink(source);
  });
}
