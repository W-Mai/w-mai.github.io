import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentInfo, AttachmentScope } from '~/types/editor-api';
import {
  deleteEditorAttachment, invalidateAttachmentCache, loadEditorAttachments,
  renameEditorAttachment, replaceEditorAttachment, uploadEditorAttachment,
} from '../editor/attachments';

const alpha: AttachmentScope = { kind: 'post', slug: 'alpha' };
const beta: AttachmentScope = { kind: 'post', slug: 'beta' };
const global: AttachmentScope = { kind: 'global' };
const item: AttachmentInfo = {
  id: 'alpha/data.txt', name: 'data.txt', size: 3, mediaType: 'text/plain',
  reference: 'attachment:alpha/data.txt', url: '/downloads/alpha/data.txt',
};

beforeEach(() => { invalidateAttachmentCache(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('attachment client scope isolation', () => {
  it('isolates global and per-post entries, including concurrent loads', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      const query = new URL(url, 'https://example.test').searchParams;
      return Response.json(query.get('slug') === 'beta' ? [] : [item]);
    });
    vi.stubGlobal('fetch', fetcher);
    const one = loadEditorAttachments(false, alpha);
    expect(loadEditorAttachments(false, { kind: 'post', slug: 'alpha' })).toBe(one);
    await Promise.all([one, loadEditorAttachments(false, beta), loadEditorAttachments(false, global)]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(await loadEditorAttachments(false, beta)).toEqual([]);
    expect(await loadEditorAttachments(false, alpha)).toEqual([item]);
    await loadEditorAttachments(true, alpha);
    await loadEditorAttachments(false, beta);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it.each(['upload', 'rename', 'replace', 'delete'] as const)('invalidates every scope after successful %s and sends explicit scope parameters', async (operation) => {
    const fetcher = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) =>
      Response.json(init?.method ? init.method === 'DELETE' ? { success: true } : item : [item]),
    );
    vi.stubGlobal('fetch', fetcher);
    await Promise.all([loadEditorAttachments(false, alpha), loadEditorAttachments(false, beta), loadEditorAttachments()]);
    const file = new File(['new'], 'different-name.txt');
    if (operation === 'upload') await uploadEditorAttachment('', file, alpha);
    if (operation === 'rename') await renameEditorAttachment(item.id, 'new.txt', alpha);
    if (operation === 'replace') await replaceEditorAttachment(item.id, file, alpha);
    if (operation === 'delete') await deleteEditorAttachment(item.id, alpha);
    const [url, init] = fetcher.mock.calls[3];
    const query = new URL(url, 'https://example.test').searchParams;
    expect(query.get('scope')).toBe('post');
    expect(query.get('slug')).toBe('alpha');
    if (operation === 'upload') { expect(query.get('group')).toBe(''); expect(init.body).toBe(file); }
    if (operation === 'rename') expect(JSON.parse(init.body)).toEqual({ id: item.id, name: 'new.txt' });
    if (operation === 'replace') { expect(query.get('id')).toBe(item.id); expect(query.has('name')).toBe(false); expect(init.body).toBe(file); }
    await Promise.all([loadEditorAttachments(false, alpha), loadEditorAttachments(false, beta), loadEditorAttachments()]);
    expect(fetcher).toHaveBeenCalledTimes(7);
  });

  it('preserves conflict status and does not invalidate snapshots after a rejected operation', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([item]))
      .mockResolvedValueOnce(Response.json({ error: '先移除引用，或使用替换' }, { status: 409 }));
    vi.stubGlobal('fetch', fetcher);
    await loadEditorAttachments(false, alpha);
    await expect(deleteEditorAttachment(item.id, alpha)).rejects.toMatchObject({ status: 409, message: '先移除引用，或使用替换' });
    expect(await loadEditorAttachments(false, alpha)).toEqual([item]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not let a pre-mutation response overwrite a fresh scope cache', async () => {
    let finish!: (response: Response) => void;
    const old = new Promise<Response>((resolveOld) => { finish = resolveOld; });
    const fresh = { ...item, size: 100 };
    const fetcher = vi.fn().mockReturnValueOnce(old)
      .mockResolvedValueOnce(Response.json(fresh))
      .mockResolvedValueOnce(Response.json([fresh]));
    vi.stubGlobal('fetch', fetcher);
    const stale = loadEditorAttachments(false, alpha);
    await replaceEditorAttachment(item.id, new File(['new'], 'ignored.bin'), alpha);
    expect(await loadEditorAttachments(false, alpha)).toEqual([fresh]);
    finish(Response.json([item]));
    await stale;
    expect(await loadEditorAttachments(false, alpha)).toEqual([fresh]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
