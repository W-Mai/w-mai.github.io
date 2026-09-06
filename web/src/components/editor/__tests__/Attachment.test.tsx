// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AttachmentPanel from '../post/panels/Attachment';
import {
  deleteEditorAttachment, loadEditorAttachments, renameEditorAttachment,
  replaceEditorAttachment, uploadEditorAttachment,
} from '~/lib/editor/attachments';
import type { AttachmentInfo, AttachmentScope } from '~/types/editor-api';

vi.mock('~/lib/editor/attachments', async (importOriginal) => {
  const original = await importOriginal<typeof import('~/lib/editor/attachments')>();
  return {
    ...original, loadEditorAttachments: vi.fn(), uploadEditorAttachment: vi.fn(),
    renameEditorAttachment: vi.fn(), replaceEditorAttachment: vi.fn(), deleteEditorAttachment: vi.fn(),
  };
});

const globalScope: AttachmentScope = { kind: 'global' };
const postScope: AttachmentScope = { kind: 'post', slug: 'article' };
const data: AttachmentInfo = {
  id: 'article/资料/数据.csv', name: '数据.csv', size: 20, mediaType: 'text/csv',
  reference: 'attachment:article/data.csv', url: '/downloads/article/data.csv',
};
const source: AttachmentInfo = {
  id: '源码/main.rs', name: 'main.rs', size: 50, mediaType: 'text/plain',
  reference: 'attachment:source', url: '/downloads/main.rs',
};
const items = [data, source];

function panel(scope = globalScope, canInsert = true) {
  const callbacks = { onInsert: vi.fn(), onChanged: vi.fn() };
  const result = render(<AttachmentPanel scope={scope} canInsert={canInsert} {...callbacks} />);
  return { ...result, ...callbacks };
}

function row(name = data.name) {
  const item = screen.getByRole('heading', { level: 3, name }).closest('li');
  if (!item) throw new Error('Expected attachment row');
  return within(item);
}

beforeEach(() => {
  vi.mocked(loadEditorAttachments).mockImplementation(async (_refresh, scope) =>
    scope?.kind === 'post' ? items.filter((item) => item.id.startsWith(scope.slug + '/')) : items,
  );
  vi.mocked(uploadEditorAttachment).mockResolvedValue(data);
  vi.mocked(renameEditorAttachment).mockResolvedValue({ ...data, name: '新数据.csv' });
  vi.mocked(replaceEditorAttachment).mockResolvedValue(data);
  vi.mocked(deleteEditorAttachment).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('attachment panel scopes', () => {
  it('loads the global scope, permits root uploads, and disables insertion without an article', async () => {
    panel(globalScope, false);
    await screen.findByRole('heading', { name: '数据.csv' });
    expect(screen.getByRole('heading', { name: '全局附件' })).toBeTruthy();
    expect(loadEditorAttachments).toHaveBeenCalledWith(true, globalScope);
    expect((screen.getByLabelText('上传目录（可选）') as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('button', { name: '上传附件' }) as HTMLButtonElement).disabled).toBe(false);
    for (const button of screen.getAllByRole('button', { name: /^插入(行内|预览)$/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    const file = new File(['root'], '根目录.txt');
    fireEvent.change(screen.getByLabelText('选择附件文件'), { target: { files: [file] } });
    await waitFor(() => expect(uploadEditorAttachment).toHaveBeenCalledWith('', file, globalScope));
    await screen.findByText('已上传：数据.csv');
    vi.mocked(uploadEditorAttachment).mockRejectedValue(new Error('上传失败，请重试。'));
    fireEvent.change(screen.getByLabelText('选择附件文件'), { target: { files: [file] } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('上传失败，请重试。');
    expect(alert.closest('li')).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('loads only the article scope and uploads a relative Unicode directory with the same scope', async () => {
    const result = panel(postScope);
    await screen.findByRole('heading', { name: '数据.csv' });
    expect(screen.getByRole('heading', { name: '当前文章附件' })).toBeTruthy();
    expect(screen.getByText('article')).toBeTruthy();
    expect(loadEditorAttachments).toHaveBeenCalledWith(true, postScope);
    expect(screen.queryByRole('heading', { name: 'main.rs' })).toBeNull();
    const group = screen.getByLabelText('文章内子目录（可选）');
    expect((group as HTMLInputElement).value).toBe('');
    fireEvent.change(group, { target: { value: '实验/中文 分组' } });
    const file = new File(['sample'], '新样本.csv');
    fireEvent.change(screen.getByLabelText('选择附件文件'), { target: { files: [file] } });
    await waitFor(() => expect(uploadEditorAttachment).toHaveBeenCalledWith('实验/中文 分组', file, postScope));
    await waitFor(() => expect(result.onChanged).toHaveBeenCalledTimes(1));
  });

  it('does not reuse the old scope listing when a pending request completes late', async () => {
    let finishOld!: (value: AttachmentInfo[]) => void;
    vi.mocked(loadEditorAttachments).mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
    const callbacks = { onInsert: vi.fn(), onChanged: vi.fn() };
    const view = render(<AttachmentPanel scope={globalScope} canInsert {...callbacks} />);
    view.rerender(<AttachmentPanel scope={postScope} canInsert {...callbacks} />);
    await screen.findByRole('heading', { name: '数据.csv' });
    await act(async () => { finishOld(items); });
    expect(screen.queryByRole('heading', { name: 'main.rs' })).toBeNull();
    expect(screen.getByRole('heading', { name: '当前文章附件' })).toBeTruthy();
  });

  it('filters metadata and keeps a literal star directory separate from all directories', async () => {
    vi.mocked(loadEditorAttachments).mockResolvedValue([...items, { ...source, id: '*/星号.rs', name: '星号.rs' }]);
    panel();
    await screen.findByRole('heading', { name: '星号.rs' });
    fireEvent.change(screen.getByLabelText('搜索附件'), { target: { value: 'text/csv' } });
    expect(screen.queryByRole('heading', { name: 'main.rs' })).toBeNull();
    fireEvent.change(screen.getByLabelText('搜索附件'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('combobox', { name: '筛选目录' }));
    fireEvent.click(screen.getByRole('option', { name: '*' }));
    expect(screen.queryByRole('heading', { name: '数据.csv' })).toBeNull();
    expect(screen.getByRole('heading', { name: '星号.rs' })).toBeTruthy();
  });
});

describe('attachment panel actions', () => {
  it('inserts both DSL forms, copies inline syntax, and retains the download target', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: copy } });
    const view = panel(postScope);
    await screen.findByRole('heading', { name: '数据.csv' });
    fireEvent.click(row().getByRole('button', { name: '插入行内' }));
    expect(view.onInsert).toHaveBeenNthCalledWith(1, ':attachment[article/data.csv]:');
    fireEvent.click(row().getByRole('button', { name: '插入预览' }));
    expect(view.onInsert).toHaveBeenNthCalledWith(2, '\n\n::attachment[article/data.csv]::\n\n');
    fireEvent.click(row().getByRole('button', { name: '复制引用' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(':attachment[article/data.csv]:'));
    const download = row().getByRole('link', { name: '下载' });
    expect(download.getAttribute('href')).toBe(data.url);
    expect(download.getAttribute('download')).toBe(data.name);
  });

  it('exposes the same pasteable inline syntax when clipboard access fails', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    panel(postScope);
    await screen.findByRole('heading', { name: '数据.csv' });
    fireEvent.click(row().getByRole('button', { name: '复制引用' }));
    await screen.findByRole('alert');
    expect(row().getByText(':attachment[article/data.csv]:').tagName).toBe('CODE');
  });

  it('renames inline, allows cancellation, and sends the current scope on save', async () => {
    const view = panel(postScope);
    await screen.findByRole('heading', { name: '数据.csv' });
    const renameButton = row().getByRole('button', { name: '重命名 数据.csv' });
    fireEvent.click(renameButton);
    fireEvent.change(screen.getByLabelText('新文件名'), { target: { value: '新数据.csv' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(renameEditorAttachment).not.toHaveBeenCalled();
    fireEvent.click(renameButton);
    fireEvent.change(screen.getByLabelText('新文件名'), { target: { value: '新数据.csv' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await screen.findByText('已重命名为：新数据.csv');
    expect(renameEditorAttachment).toHaveBeenCalledWith(data.id, '新数据.csv', postScope);
    expect(view.onChanged).toHaveBeenCalledTimes(1);
  });

  it('supports Escape cancellation in the rename form and restores trigger focus', async () => {
    panel();
    await screen.findByRole('heading', { name: '数据.csv' });
    const button = row().getByRole('button', { name: '重命名 数据.csv' });
    fireEvent.click(button);
    const input = screen.getByLabelText('新文件名');
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText('新文件名')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(renameEditorAttachment).not.toHaveBeenCalled();
  });

  it('preserves the rename form and displays a reference conflict without reporting a change', async () => {
    vi.mocked(renameEditorAttachment).mockRejectedValue(Object.assign(
      new Error('附件仍被文章引用，请先移除引用，或用替换内容保持原链接。'), { status: 409 },
    ));
    const view = panel();
    await screen.findByRole('heading', { name: '数据.csv' });
    fireEvent.click(row().getByRole('button', { name: '重命名 数据.csv' }));
    fireEvent.change(screen.getByLabelText('新文件名'), { target: { value: '新数据.csv' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    const form = screen.getByRole('form', { name: '重命名 数据.csv' });
    expect((await within(form).findByRole('alert')).textContent).toContain('替换内容保持原链接');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect((screen.getByLabelText('新文件名') as HTMLInputElement).value).toBe('新数据.csv');
    expect(view.onChanged).not.toHaveBeenCalled();
    expect((row().getByRole('button', { name: '替换内容 数据.csv' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('requires explicit confirmation before replacement and preserves the target identity', async () => {
    const view = panel(postScope);
    await screen.findByRole('heading', { name: '数据.csv' });
    const replacement = new File(['replacement'], '最新结果.csv');
    const choose = () => {
      fireEvent.click(row().getByRole('button', { name: '替换内容 数据.csv' }));
      fireEvent.change(screen.getByLabelText('选择替换文件'), { target: { files: [replacement] } });
    };
    choose();
    expect(screen.getByText('用 最新结果.csv 替换 数据.csv 的内容，链接保持不变。')).toBeTruthy();
    expect(replaceEditorAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('group', { name: '确认替换内容' })).toBeNull();
    expect(replaceEditorAttachment).not.toHaveBeenCalled();
    choose();
    fireEvent.click(screen.getByRole('button', { name: '确认替换' }));
    await screen.findByText('已替换内容：数据.csv，链接保持不变');
    expect(replaceEditorAttachment).toHaveBeenCalledWith(data.id, replacement, postScope);
    expect(view.onChanged).toHaveBeenCalledTimes(1);
    expect(row().getByRole('link', { name: '下载' }).getAttribute('href')).toBe(data.url);
  });

  it('allows cancelling deletion and prevents concurrent mutations while confirmed deletion is pending', async () => {
    let finishDelete!: () => void;
    vi.mocked(deleteEditorAttachment).mockReturnValue(new Promise<void>((resolve) => { finishDelete = resolve; }));
    const view = panel(postScope);
    await screen.findByRole('heading', { name: '数据.csv' });
    fireEvent.click(row().getByRole('button', { name: '删除 数据.csv' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(deleteEditorAttachment).not.toHaveBeenCalled();
    fireEvent.click(row().getByRole('button', { name: '删除 数据.csv' }));
    const confirm = screen.getByRole('button', { name: '确认删除' });
    fireEvent.click(confirm);
    expect((screen.getByRole('button', { name: '上传附件' }) as HTMLButtonElement).disabled).toBe(true);
    expect((row().getByRole('button', { name: '重命名 数据.csv' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(deleteEditorAttachment).toHaveBeenCalledTimes(1);
    expect(deleteEditorAttachment).toHaveBeenCalledWith(data.id, postScope);
    await act(async () => { finishDelete(); });
    await screen.findByText('已删除：数据.csv');
    expect(view.onChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps a refused deletion visible and reports the API conflict', async () => {
    vi.mocked(deleteEditorAttachment).mockRejectedValue(Object.assign(
      new Error('附件仍被引用，不能删除。请先移除文章中的引用。'), { status: 409 },
    ));
    const view = panel();
    await screen.findByRole('heading', { name: '数据.csv' });
    fireEvent.click(row().getByRole('button', { name: '删除 数据.csv' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    const confirmation = screen.getByRole('group', { name: '确认删除附件' });
    expect((await within(confirmation).findByRole('alert')).textContent).toContain('不能删除');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(view.onChanged).not.toHaveBeenCalled();
  });
});
