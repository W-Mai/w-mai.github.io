import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentInfo } from '~/types/editor-api';
import {
  invalidateAttachmentCache, loadEditorAttachments, uploadEditorAttachment,
} from '../editor/attachments';

const attachment: AttachmentInfo = {
  id: '资料/样本.csv', name: '样本.csv', size: 12, mediaType: 'text/csv',
  reference: 'attachment:%E8%B5%84%E6%96%99/%E6%A0%B7%E6%9C%AC.csv',
  url: '/downloads/%E8%B5%84%E6%96%99/%E6%A0%B7%E6%9C%AC.csv',
};

beforeEach(() => { invalidateAttachmentCache(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('attachment editor cache', () => {
  it('shares pending requests and cached listings between consumers', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([attachment]));
    vi.stubGlobal('fetch', fetcher);
    const first = loadEditorAttachments();
    expect(loadEditorAttachments()).toBe(first);
    expect(await first).toEqual([attachment]);
    expect(await loadEditorAttachments()).toEqual([attachment]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not restore an old listing when invalidated during a request', async () => {
    let finishOld!: (response: Response) => void;
    const old = new Promise<Response>((resolve) => { finishOld = resolve; });
    const fresh = { ...attachment, size: 50 };
    const fetcher = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(Response.json([fresh]));
    vi.stubGlobal('fetch', fetcher);
    const staleRequest = loadEditorAttachments();
    invalidateAttachmentCache();
    expect(await loadEditorAttachments()).toEqual([fresh]);
    finishOld(Response.json([attachment]));
    await staleRequest;
    expect(await loadEditorAttachments()).toEqual([fresh]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not cache failed requests', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: '读取失败' }, { status: 500 }))
      .mockResolvedValueOnce(Response.json([attachment]));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadEditorAttachments()).rejects.toThrow('读取失败');
    expect(await loadEditorAttachments()).toEqual([attachment]);
  });

  it('uploads original filename and raw bytes, uses the returned identity, and invalidates listings', async () => {
    const renamed = { ...attachment, id: '资料/样本 (1).csv', reference: 'attachment:new-id' };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([attachment]))
      .mockResolvedValueOnce(Response.json(renamed, { status: 201 }))
      .mockResolvedValueOnce(Response.json([attachment, renamed]));
    vi.stubGlobal('fetch', fetcher);
    await loadEditorAttachments();
    const file = new File(['a,b'], '样本.csv', { type: 'text/csv' });
    expect(await uploadEditorAttachment('资料/中文 分组', file)).toEqual(renamed);
    const [url, init] = fetcher.mock.calls[1];
    const query = new URL(url, 'https://example.com').searchParams;
    expect(query.get('group')).toBe('资料/中文 分组');
    expect(query.get('name')).toBe('样本.csv');
    expect(init.body).toBe(file);
    expect(init.method).toBe('POST');
    expect(await loadEditorAttachments()).toEqual([attachment, renamed]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
