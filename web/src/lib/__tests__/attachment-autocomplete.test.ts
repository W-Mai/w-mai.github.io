import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { assetCompletion, attachmentCompletion, stickerSyntaxCompletion } from '../editor/autocomplete';
import { invalidateAttachmentCache } from '../editor/attachments';
import { attachmentReference } from '../attachments/paths';

const id = '资料/中文 分组/样本[1] (%).csv';
const entry = {
  id, name: '样本[1] (%).csv', size: 64, mediaType: 'text/csv',
  reference: attachmentReference(id), url: '/downloads/data.csv',
};
const encodedId = entry.reference.slice('attachment:'.length);

function context(source: string, position = source.length) {
  return new CompletionContext(EditorState.create({ doc: source, extensions: [markdown()] }), position, true);
}

beforeEach(() => {
  invalidateAttachmentCache();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([entry])));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('attachment completion boundaries', () => {
  it.each([
    [':attachment[', ':'],
    ['请下载 :attachment[资料', ':'],
    ['- :attachment[资料', ':'],
    ['> :attachment[资料', ':'],
    [':attachment[%E8%B5%84', ':'],
    ['::attachment[', '::'],
    ['   ::attachment[样本', '::'],
  ])('inserts canonical syntax for the selected inline or block form: %s', async (source, colons) => {
    const result = await attachmentCompletion(context(source));
    expect(result?.from).toBe(source.indexOf(colons + 'attachment['));
    expect(result?.options[0]).toMatchObject({ label: id, apply: colons + 'attachment[' + encodedId + ']' + colons });
  });

  it.each([
    [':attachment[|]', ':'],
    [':attachment[|]:', ':'],
    [':attachment[资料|/old.csv]:', ':'],
    ['::attachment[|]', '::'],
    ['::attachment[|]:', '::'],
    ['::attachment[资料|/old.csv]::', '::'],
  ])('replaces existing filename suffixes and closers without duplication: %s', async (marked, colons) => {
    const position = marked.indexOf('|');
    const source = marked.replace('|', '');
    const result = await attachmentCompletion(context(source, position));
    expect(result).not.toBeNull();
    const option = result!.options[0];
    expect(typeof option.apply).toBe('string');
    const updated = source.slice(0, result!.from) + option.apply + source.slice(result!.to ?? position);
    expect(updated).toBe(colons + 'attachment[' + encodedId + ']' + colons);
  });

  it('continues directly after an inserted attachment without confusing its closing colon with a block opener', async () => {
    const previous = ':attachment[shared/previous.csv]:';
    const result = await attachmentCompletion(context(previous + ':attachment['));
    expect(result?.from).toBe(previous.length);
    expect(result?.options[0].apply).toBe(':attachment[' + encodedId + ']:');
  });

  it('parses the context of a long document before offering suggestions inside an unfinished code fence', async () => {
    const source = '```text\n' + 'example line\n'.repeat(1000) + ':attachment[';
    expect(await attachmentCompletion(context(source))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps attachment syntax eligible when its bracket matches a Markdown reference definition', async () => {
    const source = ':attachment[资料]:\n\n[资料]: https://example.test';
    const result = await attachmentCompletion(context(source, source.indexOf(']')));
    expect(result?.options[0].apply).toBe(':attachment[' + encodedId + ']:');
    expect(source.slice(result?.to)).toBe('\n\n[资料]: https://example.test');
  });

  it('preserves prose after an existing inline closing delimiter', async () => {
    const source = '下载 :attachment[]:，然后继续。';
    const position = source.indexOf(']');
    const result = await attachmentCompletion(context(source, position));
    expect(result).not.toBeNull();
    const updated = source.slice(0, result!.from) + result!.options[0].apply + source.slice(result!.to ?? position);
    expect(updated).toBe('下载 :attachment[' + encodedId + ']:，然后继续。');
  });

  it.each([
    'attachment:资料', '[下载](attachment:', '[ref]: attachment:', '![图片](attachment:',
    '::sticker[', ':sticker[example :attachment[', '::sticker[example ::attachment[',
    '\\:attachment[', '\\::attachment[', ':::attachment[', '正文 ::attachment[',
    '> ::attachment[', '- ::attachment[', '    ::attachment[',
    '- text\n  ::attachment[', '> text\n::attachment[', 'text\n::attachment[',
  ])('does not claim legacy URI, sticker, escaped, or non-block contexts: %s', async (source) => {
    expect(await attachmentCompletion(context(source))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    '`example :attachment[|`',
    '``example ::attachment[|``',
    '```md\n:attachment[|\n```',
    '~~~\n::attachment[|\n~~~',
    '```\n:attachment[|',
    '    :attachment[|',
    '[下载](:attachment[|)',
  ])('does not fetch or suggest inside code or an existing link: %s', async (marked) => {
    const position = marked.indexOf('|');
    expect(await attachmentCompletion(context(marked.replace('|', ''), position))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a block followed by prose and keeps sticker completion separate', async () => {
    const source = '::attachment[]:: prose';
    expect(await attachmentCompletion(context(source, source.indexOf(']')))).toBeNull();
    expect(stickerSyntaxCompletion(context(':attachment[group/:s'))).toBeNull();
    expect(stickerSyntaxCompletion(context('::attachment[group/:s'))).toBeNull();
    expect(stickerSyntaxCompletion(context(':s'))?.options[0].label).toBe(':sticker[…]:');
    expect(stickerSyntaxCompletion(context('::s'))?.options[0].label).toBe('::sticker[…]::');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not let image completion claim an attachment destination', async () => {
    expect(await assetCompletion(context('[下载](attachment:'))).toBeNull();
    expect(await assetCompletion(context(':attachment['))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns no suggestions when loading fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    expect(await attachmentCompletion(context(':attachment['))).toBeNull();
  });
});
