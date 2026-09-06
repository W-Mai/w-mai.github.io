/** Public attachment metadata. Local filesystem paths stay server-side. */
export interface AttachmentInfo {
  id: string;
  name: string;
  size: number;
  mediaType: string;
  reference: string;
  url: string;
}

export type AttachmentScope = { kind: 'global' } | { kind: 'post'; slug: string };

export interface AttachmentOptions {
  directory: string;
  base?: string;
  site?: string;
  scope?: AttachmentScope;
  postsDirectory?: string;
  thoughtsDirectory?: string;
}

function invalidPath(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}

/** Validate a decoded, root-relative identifier without normalizing its name. */
export function validateAttachmentId(id: string): string {
  if (typeof id !== 'string' || id.length === 0) {
    throw invalidPath('Attachment ID must be a non-empty relative path');
  }
  if (/^[a-z]:/i.test(id) || /[\\\u0000-\u001f\u007f-\u009f]/u.test(id)) {
    throw invalidPath(`Invalid attachment ID: ${JSON.stringify(id)}`);
  }
  for (const segment of id.split('/')) {
    if (!segment || segment.startsWith('.')) {
      throw invalidPath(`Attachment ID contains an empty, hidden, or dot segment: ${JSON.stringify(id)}`);
    }
  }
  try {
    encodeURIComponent(id);
  } catch {
    throw invalidPath('Attachment ID contains invalid Unicode');
  }
  return id;
}

/** Decode exactly once, keeping encoded path separators out of identifiers. */
export function parseAttachmentReference(reference: string): string | null {
  if (!reference.startsWith('attachment:')) return null;
  const segments = reference.slice('attachment:'.length).split('/').map((segment) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw invalidPath(`Malformed attachment reference: ${JSON.stringify(reference)}`);
    }
    if (decoded.includes('/') || decoded.includes('\\')) {
      throw invalidPath(`Attachment reference contains an encoded path separator: ${JSON.stringify(reference)}`);
    }
    return decoded;
  });
  return validateAttachmentId(segments.join('/'));
}

/** Encode punctuation that also has structural meaning in Markdown links. */
function encodedAttachmentId(id: string): string {
  return validateAttachmentId(id).split('/').map((segment) =>
    encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    ),
  ).join('/');
}

export function attachmentReference(id: string): string {
  return `attachment:${encodedAttachmentId(id)}`;
}

export function attachmentUrl(id: string, base = '/'): string {
  if (!base.startsWith('/') || /[\\?#\u0000-\u001f\u007f]/u.test(base)) {
    throw invalidPath('Attachment URL base must be an absolute URL path');
  }
  const prefix = base.replace(/\/+$/, '');
  if (prefix && prefix.slice(1).split('/').some((part) => !part || part === '.' || part === '..')) {
    throw invalidPath('Attachment URL base contains an invalid path segment');
  }
  return `${prefix}/downloads/${encodedAttachmentId(id)}`;
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new RangeError('Attachment size must be a non-negative safe integer');
  }
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${Number(value.toFixed(1))} ${units[index]}`;
}

/** Validate the shape and path boundary of an editor scope without filesystem access. */
export function validateAttachmentScope(scope: AttachmentScope): AttachmentScope {
  if (!scope || typeof scope !== 'object') throw invalidPath('Invalid attachment scope');
  if (scope.kind === 'global') return { kind: 'global' };
  if (scope.kind !== 'post' || typeof scope.slug !== 'string') throw invalidPath('Invalid attachment scope');
  validateAttachmentId(scope.slug);
  if (scope.slug.includes('/')) throw invalidPath('Post slug must be one directory name');
  return { kind: 'post', slug: scope.slug };
}
