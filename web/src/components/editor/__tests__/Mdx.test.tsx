// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { acceptCompletion, currentCompletions, startCompletion } from '@codemirror/autocomplete';
import { createRef } from 'react';
import MdxEditor, { type MdxEditorHandle } from '../post/Mdx';
import { attachmentInlineSyntax, attachmentBlockSyntax } from '~/lib/attachments/syntax';
import { attachmentReference } from '~/lib/attachments/paths';
import { invalidateAttachmentCache } from '~/lib/editor/attachments';

const clientRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
const boundingRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');

beforeEach(() => {
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  });
});
afterEach(() => {
  cleanup();
  invalidateAttachmentCache();
  vi.unstubAllGlobals();
  if (clientRects) Object.defineProperty(Range.prototype, 'getClientRects', clientRects);
  else Reflect.deleteProperty(Range.prototype, 'getClientRects');
  if (boundingRect) Object.defineProperty(Range.prototype, 'getBoundingClientRect', boundingRect);
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
});

describe('editor insertion contract', () => {
  it('preserves the saved cursor while blurred and leaves it after successive attachment insertions', () => {
    const handle = createRef<MdxEditorHandle>();
    const onChange = vi.fn();
    render(<MdxEditor ref={handle} content="beforeafter" onChange={onChange} onSave={vi.fn()} />);
    const view = handle.current!.getView()!;
    act(() => { view.dispatch({ selection: { anchor: 6 } }); });
    view.contentDOM.blur();
    const inline = attachmentInlineSyntax('attachment:shared/data.csv');
    const block = '\n\n' + attachmentBlockSyntax('attachment:shared/preview.pdf') + '\n\n';
    act(() => {
      handle.current!.insertText(inline);
      handle.current!.insertText(block);
    });
    expect(view.state.doc.toString()).toBe('before' + inline + block + 'after');
    expect(view.state.selection.main.head).toBe(6 + inline.length + block.length);
    expect(view.state.selection.main.empty).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith('before' + inline + block + 'after');
  });

  it('keeps selected prose intact when a panel inserts at its saved head', () => {
    const handle = createRef<MdxEditorHandle>();
    render(<MdxEditor ref={handle} content="selected prose" onChange={vi.fn()} onSave={vi.fn()} />);
    const view = handle.current!.getView()!;
    const inline = attachmentInlineSyntax('attachment:shared/data.csv');
    act(() => {
      view.dispatch({ selection: { anchor: 0, head: 8 } });
      handle.current!.insertText(inline);
    });
    expect(view.state.doc.toString()).toBe('selected' + inline + ' prose');
    expect(view.state.selection.main.head).toBe(8 + inline.length);
    expect(view.state.selection.main.empty).toBe(true);
  });

  it.each([':', '::'])('accepts a real %s completion without duplicate closers and places the cursor after it', async (marker) => {
    const entry = {
      id: 'shared/样本[1].csv', name: '样本[1].csv', size: 20, mediaType: 'text/csv',
      reference: attachmentReference('shared/样本[1].csv'), url: '/downloads/sample.csv',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([entry])));
    const handle = createRef<MdxEditorHandle>();
    const source = marker + 'attachment[]' + marker;
    render(<MdxEditor ref={handle} content={source} onChange={vi.fn()} onSave={vi.fn()} />);
    const view = handle.current!.getView()!;
    act(() => {
      view.dispatch({ selection: { anchor: source.indexOf(']') } });
      startCompletion(view);
    });
    await waitFor(() => expect(currentCompletions(view.state)[0]?.label).toBe(entry.id));
    await waitFor(() => { act(() => { expect(acceptCompletion(view)).toBe(true); }); });
    const expected = marker === ':' ? attachmentInlineSyntax(entry.reference) : attachmentBlockSyntax(entry.reference);
    expect(view.state.doc.toString()).toBe(expected);
    expect(view.state.selection.main.head).toBe(expected.length);
    expect(view.state.selection.main.empty).toBe(true);
  });
});
