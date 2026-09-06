import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { assetCompletion, attachmentCompletion } from '../editor/autocomplete';
import { invalidateAttachmentCache } from '../editor/attachments';
import { attachmentReference } from '../attachments/paths';

const id = '资料/中文 分组/样本.csv';
const entry = {
  id, name: '样本.csv', size: 64, mediaType: 'text/csv',
  reference: attachmentReference(id), url: '/downloads/data.csv',
};

function context(source: string) {
  return new CompletionContext(EditorState.create({ doc: source }), source.length, true);
}

beforeEach(() => {
  invalidateAttachmentCache();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([entry])));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('attachment completion boundaries', () => {
  it.each(['[下载](attachment:', '[下载](attachment:资料', '[ref]: attachment:%E8%B5%84'])(
    'inserts the complete canonical reference at the destination: %s',
    async (source) => {
      const result = await attachmentCompletion(context(source));
      expect(result?.from).toBe(source.indexOf('attachment:'));
      expect(result?.options[0]).toMatchObject({ label: id, apply: entry.reference });
    },
  );

  it('does not let image completion claim an attachment destination', async () => {
    expect(await assetCompletion(context('[下载](attachment:'))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['attachment:资料', '![图片](attachment:', '[下载](https://example.com'])(
    'does not claim non-link or image contexts: %s',
    async (source) => {
      expect(await attachmentCompletion(context(source))).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('returns no suggestions when loading fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    expect(await attachmentCompletion(context('[下载](attachment:'))).toBeNull();
  });
});
