import type { APIRoute } from 'astro';
import options from 'virtual:attachments/config';
import {
  listAttachments, storeAttachment, renameAttachment, replaceAttachment, deleteAttachment,
  MAX_ATTACHMENT_UPLOAD_BYTES,
} from '~/lib/attachments/files';
import { validateAttachmentScope } from '~/lib/attachments/paths';
import type { AttachmentOptions, AttachmentScope } from '~/lib/attachments/paths';
import { json } from './shared';

export const prerender = false;

function badRequest(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}

function scopedOptions(url?: URL): AttachmentOptions {
  const kind = url?.searchParams.get('scope') ?? 'global';
  let scope: AttachmentScope;
  if (kind === 'global') scope = { kind };
  else if (kind === 'post') scope = { kind, slug: url?.searchParams.get('slug') ?? '' };
  else throw badRequest('附件作用域无效');
  return { ...options, scope: validateAttachmentScope(scope) };
}

function failure(error: unknown): Response {
  const status = typeof error === 'object' && error !== null && 'status' in error
    && typeof error.status === 'number' && [400, 403, 404, 409, 413].includes(error.status)
    ? error.status : 500;
  const message = error instanceof Error ? error.message : '附件操作失败';
  return json({ error: message }, status);
}

async function uploadBody(request: Request): Promise<ReadableStream<Uint8Array>> {
  if (!request.body) throw badRequest('请选择要上传的文件');
  const declaredSize = request.headers.get('Content-Length');
  if (declaredSize && Number(declaredSize) > MAX_ATTACHMENT_UPLOAD_BYTES) {
    try { await request.body.cancel(); } catch { /* Reject before storing any bytes. */ }
    throw Object.assign(new Error('单个附件不能超过 32 MiB'), { status: 413 });
  }
  return request.body;
}

function queryId(url: URL): string {
  const id = url.searchParams.get('id');
  if (!id) throw badRequest('请提供附件标识');
  return id;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const response = json(await listAttachments(scopedOptions(url)));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) { return failure(error); }
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const scoped = scopedOptions(url);
    const group = url.searchParams.get('group') ?? '';
    const name = url.searchParams.get('name');
    if (!name) throw badRequest('请提供文件名');
    const attachment = await storeAttachment(group, name, await uploadBody(request), scoped);
    return json(attachment, 201);
  } catch (error) { return failure(error); }
};

export const PATCH: APIRoute = async ({ request, url }) => {
  try {
    const scoped = scopedOptions(url);
    const body = await request.json().catch(() => { throw badRequest('重命名请求必须是 JSON'); });
    if (!body || typeof body.id !== 'string' || typeof body.name !== 'string') {
      throw badRequest('请提供附件标识和新文件名');
    }
    return json(await renameAttachment(body.id, body.name, scoped));
  } catch (error) { return failure(error); }
};

export const PUT: APIRoute = async ({ request, url }) => {
  try {
    const scoped = scopedOptions(url);
    const id = queryId(url);
    return json(await replaceAttachment(id, await uploadBody(request), scoped));
  } catch (error) { return failure(error); }
};

export const DELETE: APIRoute = async ({ url }) => {
  try {
    await deleteAttachment(queryId(url), scopedOptions(url));
    return json({ success: true });
  } catch (error) { return failure(error); }
};
