import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AttachmentInfo, AttachmentScope } from '~/types/editor-api';
import { formatAttachmentSize } from '~/lib/attachments/paths';
import {
  attachmentMarkdownLink, deleteEditorAttachment, loadEditorAttachments,
  renameEditorAttachment, replaceEditorAttachment, uploadEditorAttachment,
} from '~/lib/editor/attachments';
import EditorSelect from '~/components/editor/shared/Select';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';

interface AttachmentPanelProps {
  scope: AttachmentScope;
  canInsert: boolean;
  refreshKey?: number;
  onInsert: (markdown: string) => void;
  onChanged: () => void;
}

type FileAction =
  | { kind: 'rename'; attachment: AttachmentInfo; name: string }
  | { kind: 'delete'; attachment: AttachmentInfo }
  | { kind: 'replace'; attachment: AttachmentInfo; file: File };

const styles = `
  .attachment-panel {
    display: flex; flex-direction: column; gap: ${T.spacingXl};
    height: 100%; min-height: 0; min-width: 0; box-sizing: border-box; overflow-y: auto;
    padding: ${T.spacingXl}; color: ${T.colorText};
    background: ${T.colorBg}; font: ${T.fontSizeSm} ${T.fontSans};
  }
  .attachment-panel *, .attachment-panel *::before, .attachment-panel *::after { box-sizing: border-box; }
  .attachment-heading { display: flex; flex-shrink: 0; align-items: start; gap: ${T.spacingLg}; justify-content: space-between; }
  .attachment-heading h2 { margin: 0; font-size: ${T.fontSizeLg}; color: ${T.colorAccent}; }
  .attachment-caption { margin: ${T.spacingXs} 0 0; color: ${T.colorTextMuted}; overflow-wrap: anywhere; }
  .attachment-controls {
    display: flex; flex-direction: column; gap: ${T.spacingLg}; flex-shrink: 0;
    padding: ${T.spacingXl}; margin: 0; border: none; border-radius: ${T.radiusLg};
    background: ${T.colorBg}; box-shadow: ${T.shadowRaised};
  }
  .attachment-fields { display: flex; align-items: end; flex-wrap: wrap; gap: ${T.spacingLg}; }
  .attachment-field { display: flex; flex: 1 1 12rem; flex-direction: column; gap: ${T.spacingSm}; min-width: 0; color: ${T.colorTextSecondary}; }
  .attachment-field-small { flex-basis: 9rem; }
  .attachment-input {
    width: 100%; min-width: 0; padding: ${T.spacingLg};
    color: ${T.colorText}; background: ${T.colorBg}; border: none; outline: none;
    border-radius: ${T.radiusMd}; box-shadow: ${T.shadowInset};
    font: inherit; transition: box-shadow ${T.transitionFast}, opacity ${T.transitionFast};
  }
  .attachment-input::placeholder { color: ${T.colorTextMuted}; opacity: 1; }
  .attachment-panel .attachment-button {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 2.25rem; padding: ${T.spacingMd} ${T.spacingLg}; flex-shrink: 0;
    border: none; border-radius: ${T.radiusMd}; font: inherit; line-height: 1.3;
    color: ${T.colorTextSecondary}; background: ${T.colorBg};
    box-shadow: ${T.shadowBtn}; cursor: pointer; text-decoration: none;
    transition: box-shadow ${T.transitionFast}, transform ${T.transitionFast}, opacity ${T.transitionFast};
  }
  .attachment-panel .attachment-button:hover:not(:disabled):not([aria-disabled="true"]) {
    box-shadow: ${T.shadowBtnHover};
    background: linear-gradient(145deg, var(--neu-gradient-light), var(--neu-gradient-dark));
    transform: translateY(1px);
  }
  .attachment-panel .attachment-button:active:not(:disabled):not([aria-disabled="true"]) {
    box-shadow: ${T.shadowInset}; transform: translateY(0);
  }
  .attachment-panel .attachment-button:disabled,
  .attachment-panel .attachment-button[aria-disabled="true"] {
    opacity: 0.45; cursor: not-allowed; transform: none;
    background: ${T.colorBg}; box-shadow: ${T.shadowInset};
  }
  .attachment-input:disabled { opacity: 0.6; cursor: not-allowed; }
  .attachment-panel .attachment-button:focus-visible,
  .attachment-input:focus-visible, .attachment-reference:focus-visible {
    outline: none; box-shadow: ${T.shadowInset};
  }
  .attachment-panel .attachment-primary { color: ${T.colorAccent}; font-weight: 600; }
  .attachment-panel .attachment-danger { color: ${T.colorError}; }
  .attachment-help, .attachment-status { margin: 0; color: ${T.colorTextMuted}; font-size: ${T.fontSizeXs}; overflow-wrap: anywhere; }
  .attachment-error {
    margin: 0; padding: ${T.spacingLg}; border-radius: ${T.radiusMd};
    background: ${T.colorErrorBg}; color: ${T.colorError}; box-shadow: ${T.shadowInset}; overflow-wrap: anywhere;
  }
  .attachment-list-scroll { flex: 1 0 auto; min-height: 0; margin: -${T.spacingSm}; padding: ${T.spacingSm}; }
  .attachment-list { list-style: none; padding: 0; margin: 0; display: grid; gap: ${T.spacingXl}; }
  .attachment-card {
    min-width: 0; padding: ${T.spacingXl}; border: none; border-radius: ${T.radiusLg};
    background: ${T.colorBg}; box-shadow: ${T.shadowRaised};
  }
  .attachment-file { display: flex; align-items: center; gap: ${T.spacingLg}; }
  .attachment-file-icon {
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: 2.5rem; height: 2.5rem; border-radius: ${T.radiusMd};
    color: ${T.colorTextMuted}; background: ${T.colorBg}; box-shadow: ${T.shadowBtn};
  }
  .attachment-file-info { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .attachment-name { margin: 0; font-weight: 600; font-size: ${T.fontSizeMd}; color: ${T.colorAccent}; }
  .attachment-meta { margin: ${T.spacingXs} 0 0; color: ${T.colorTextMuted}; font-size: ${T.fontSizeXs}; }
  .attachment-actions { display: flex; flex-wrap: wrap; gap: ${T.spacingMd}; margin-top: ${T.spacingLg}; }
  .attachment-actions .attachment-button { font-size: ${T.fontSizeXs}; }
  .attachment-inline {
    display: flex; flex-direction: column; gap: ${T.spacingLg}; margin-top: ${T.spacingXl};
    padding: ${T.spacingLg}; border: none; border-radius: ${T.radiusMd}; box-shadow: ${T.shadowInset};
  }
  .attachment-inline .attachment-field { flex: initial; }
  .attachment-inline p { margin: 0; overflow-wrap: anywhere; }
  .attachment-inline .attachment-actions { margin-top: 0; }
  .attachment-reference {
    display: block; margin-top: ${T.spacingLg}; padding: ${T.spacingMd}; border-radius: ${T.radiusSm};
    font: ${T.fontSizeXs} ${T.fontMono}; color: ${T.colorTextSecondary}; background: ${T.colorBg};
    box-shadow: ${T.shadowInset}; overflow-wrap: anywhere; user-select: all;
  }
  .attachment-empty { padding: ${T.spacing3xl}; text-align: center; color: ${T.colorTextMuted}; }
  @media (prefers-reduced-motion: reduce) {
    .attachment-panel .attachment-button, .attachment-input { transition: none; }
  }
`;

function directoryOf(id: string): string {
  const slash = id.lastIndexOf('/');
  return slash < 0 ? '' : id.slice(0, slash);
}

function actionError(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return '附件操作失败，请重试';
}

export default function AttachmentPanel({
  scope, canInsert, refreshKey = 0, onInsert, onChanged,
}: AttachmentPanelProps) {
  const formId = useId();
  const scopeSlug = scope.kind === 'post' ? scope.slug : null;
  const activeScope = useMemo<AttachmentScope>(
    () => scopeSlug === null ? { kind: 'global' } : { kind: 'post', slug: scopeSlug },
    [scopeSlug],
  );
  const scopeKey = scopeSlug === null ? 'global' : 'post:' + scopeSlug;
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const [listing, setListing] = useState<{ scope: string; items: AttachmentInfo[] }>({ scope: scopeKey, items: [] });
  const [group, setGroup] = useState('');
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<FileAction | null>(null);
  const [error, setError] = useState<{ message: string; attachmentId?: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<{ scope: string; attachment: AttachmentInfo } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const loadVersion = useRef(0);
  const operationInProgress = useRef(false);
  const title = scopeSlug === null ? '全局附件' : '当前文章附件';
  const attachments = listing.scope === scopeKey ? listing.items : [];
  const relativeId = (attachment: AttachmentInfo) => scopeSlug === null
    ? attachment.id : attachment.id.slice(scopeSlug.length + 1);

  const reload = useCallback(async (refresh = false) => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const items = await loadEditorAttachments(refresh, activeScope);
      if (version === loadVersion.current && currentScope.current === scopeKey) {
        setListing({ scope: scopeKey, items });
      }
    } catch (cause) {
      if (version === loadVersion.current) setError({ message: actionError(cause) });
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [activeScope, scopeKey]);

  useEffect(() => {
    setGroup('');
    setQuery('');
    setFilterGroup(null);
    setAction(null);
    setError(null);
    setNotice('');
    setCopyFallback(null);
    replaceTarget.current = null;
  }, [scopeKey]);

  useEffect(() => {
    void reload(true);
    return () => { loadVersion.current += 1; };
  }, [reload, refreshKey]);

  const groups = [...new Set(attachments.map((item) => directoryOf(relativeId(item))))]
    .sort((a, b) => a.localeCompare(b));
  const search = query.trim().toLocaleLowerCase();
  const visible = attachments.filter((item) =>
    (filterGroup === null || directoryOf(relativeId(item)) === filterGroup)
    && [item.id, item.name, item.mediaType].some((value) => value.toLocaleLowerCase().includes(search)),
  );

  const closeAction = () => {
    setAction(null);
    returnFocus.current?.focus();
  };

  const mutate = async (message: string, operation: () => Promise<string>, attachmentId?: string) => {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    const startedScope = scopeKey;
    setBusy(message);
    setError(null);
    setNotice('');
    try {
      const success = await operation();
      onChanged();
      if (currentScope.current === startedScope) {
        setNotice(success);
        setAction(null);
        setFilterGroup(null);
        setQuery('');
        await reload(true);
      }
    } catch (cause) {
      if (currentScope.current === startedScope) setError({ message: actionError(cause), attachmentId });
    } finally {
      operationInProgress.current = false;
      setBusy(null);
    }
  };

  const upload = (file: File) => mutate('正在上传…', async () => {
    const item = await uploadEditorAttachment(group, file, activeScope);
    return '已上传：' + item.name;
  });

  const submitAction = () => {
    if (!action) return;
    const selected = action;
    if (selected.kind === 'rename') {
      void mutate('正在重命名…', async () => {
        const item = await renameEditorAttachment(selected.attachment.id, selected.name, activeScope);
        return '已重命名为：' + item.name;
      }, selected.attachment.id);
    } else if (selected.kind === 'replace') {
      void mutate('正在替换…', async () => {
        const item = await replaceEditorAttachment(selected.attachment.id, selected.file, activeScope);
        return '已替换内容：' + item.name + '，链接保持不变';
      }, selected.attachment.id);
    } else {
      void mutate('正在删除…', async () => {
        await deleteEditorAttachment(selected.attachment.id, activeScope);
        return '已删除：' + selected.attachment.name;
      }, selected.attachment.id);
    }
  };

  const copyReference = async (attachment: AttachmentInfo) => {
    try {
      await navigator.clipboard.writeText(attachment.reference);
      setCopyFallback(null);
      setError(null);
      setNotice('已复制引用：' + attachment.name);
    } catch {
      setCopyFallback(attachment.id);
      setError({ message: '无法访问剪贴板，请选中下方的附件引用后复制' });
    }
  };

  const showInlineError = error?.attachmentId !== undefined
    && action?.attachment.id === error.attachmentId
    && visible.some((attachment) => attachment.id === error.attachmentId);
  const buttonsDisabled = Boolean(busy);
  const uploadPath = [scopeSlug, group].filter(Boolean).join('/');

  return (
    <section className="attachment-panel" aria-labelledby={formId + '-title'}>
      <style>{styles}</style>
      <header className="attachment-heading">
        <div>
          <h2 id={formId + '-title'}>{title}</h2>
          <p className="attachment-caption">{scopeSlug ?? '管理所有文章的附件，也可在文章间共享。'}</p>
        </div>
        <button
          type="button" className="neu-editor-btn attachment-button" disabled={loading || buttonsDisabled}
          onClick={() => { setError(null); void reload(true); }}
        >刷新</button>
      </header>

      <div className="attachment-controls">
        <div className="attachment-fields">
          <label htmlFor={formId + '-group'} className="attachment-field">
            {scopeSlug === null ? '上传目录（可选）' : '文章内子目录（可选）'}
            <input
              id={formId + '-group'} className="attachment-input" value={group} disabled={buttonsDisabled}
              onChange={(event) => setGroup(event.target.value)}
              placeholder={scopeSlug === null ? '留空保存到根目录' : '留空保存到这篇文章的附件目录'}
              aria-describedby={formId + '-upload-help'}
            />
          </label>
          <button
            type="button" className="neu-editor-btn attachment-button attachment-primary"
            disabled={buttonsDisabled} onClick={() => fileInput.current?.click()}
          >上传附件</button>
        </div>
        <p id={formId + '-upload-help'} className="attachment-help">
          {uploadPath ? '保存到：' + uploadPath + '。' : '保存到附件根目录。'}单文件上限 32 MiB。
        </p>
        <input
          ref={fileInput} type="file" aria-label="选择附件文件" hidden disabled={buttonsDisabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
        <input
          ref={replaceInput} type="file" aria-label="选择替换文件" hidden disabled={buttonsDisabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            const target = replaceTarget.current;
            event.target.value = '';
            replaceTarget.current = null;
            if (file && target?.scope === scopeKey) {
              setError(null);
              setAction({ kind: 'replace', attachment: target.attachment, file });
            }
          }}
        />
        <div className="attachment-fields">
          <label htmlFor={formId + '-search'} className="attachment-field">
            搜索附件
            <input
              id={formId + '-search'} className="attachment-input" type="search" value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="文件名、目录或类型"
            />
          </label>
          <div className="attachment-field attachment-field-small">
            <label id={formId + '-filter-label'} htmlFor={formId + '-filter'}>筛选目录</label>
            <EditorSelect
              key={scopeKey}
              id={formId + '-filter'}
              label="筛选目录"
              disabled={loading || buttonsDisabled}
              value={filterGroup === null ? 'all' : JSON.stringify(filterGroup)}
              options={[
                { value: 'all', label: '全部目录' },
                ...groups.map((item) => ({
                  value: JSON.stringify(item),
                  label: item || (scopeSlug === null ? '根目录' : '文章目录'),
                })),
              ]}
              onChange={(value) => setFilterGroup(value === 'all' ? null : JSON.parse(value))}
            />
          </div>
        </div>
      </div>
      {!canInsert && <p className="attachment-help">选择文章后可插入链接。</p>}
      {error && !showInlineError && <p role="alert" className="attachment-error">{error.message}</p>}
      <p role="status" aria-live="polite" className="attachment-status">
        {busy || (loading ? '正在读取附件…' : notice || '共 ' + visible.length + ' 个附件')}
      </p>
      <div className="attachment-list-scroll" aria-busy={loading || buttonsDisabled}>
        {!loading && visible.length === 0 && <p className="attachment-empty">
          {attachments.length ? '没有匹配的附件。' : '暂无附件，上传文件后即可引用。'}
        </p>}
        <ul className="attachment-list">
          {visible.map((attachment) => {
            const editing = action?.attachment.id === attachment.id ? action : null;
            const location = directoryOf(relativeId(attachment));
            return (
              <li key={attachment.id} className="attachment-card">
                <div className="attachment-file">
                  <span className="attachment-file-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <path d="M14 3v6h6M8 13h8M8 17h6" />
                    </svg>
                  </span>
                  <div className="attachment-file-info">
                    <h3 className="attachment-name">{attachment.name}</h3>
                    <p className="attachment-meta">
                      {location ? location + ' · ' : ''}{formatAttachmentSize(attachment.size)} · {attachment.mediaType}
                    </p>
                  </div>
                </div>
                <div className="attachment-actions">
                  <button
                    type="button" className="neu-editor-btn attachment-button attachment-primary"
                    disabled={!canInsert || buttonsDisabled} title={canInsert ? '插入到文章光标位置' : '请先选择文章'}
                    onClick={() => onInsert(attachmentMarkdownLink(attachment))}
                  >插入链接</button>
                  <button type="button" className="neu-editor-btn attachment-button" disabled={buttonsDisabled}
                    onClick={() => void copyReference(attachment)}>复制引用</button>
                  <a className="neu-editor-btn attachment-button" href={attachment.url} download={attachment.name}
                    aria-disabled={buttonsDisabled} tabIndex={buttonsDisabled ? -1 : undefined}
                    onClick={(event) => { if (buttonsDisabled) event.preventDefault(); }}>下载</a>
                  <button
                    type="button" className="neu-editor-btn attachment-button" disabled={buttonsDisabled}
                    aria-label={'重命名 ' + attachment.name}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget;
                      setError(null);
                      setAction({ kind: 'rename', attachment, name: attachment.name });
                    }}
                  >重命名</button>
                  <button
                    type="button" className="neu-editor-btn attachment-button" disabled={buttonsDisabled}
                    aria-label={'替换内容 ' + attachment.name}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget;
                      replaceTarget.current = { scope: scopeKey, attachment };
                      replaceInput.current?.click();
                    }}
                  >替换内容</button>
                  <button
                    type="button" className="neu-editor-btn attachment-button attachment-danger" disabled={buttonsDisabled}
                    aria-label={'删除 ' + attachment.name}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget;
                      setError(null);
                      setAction({ kind: 'delete', attachment });
                    }}
                  >删除</button>
                </div>
                {copyFallback === attachment.id && <code className="attachment-reference" tabIndex={0}>
                  {attachment.reference}
                </code>}
                {editing?.kind === 'rename' && <form
                  className="attachment-inline" aria-label={'重命名 ' + attachment.name}
                  onSubmit={(event) => { event.preventDefault(); submitAction(); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && !buttonsDisabled) { event.preventDefault(); event.stopPropagation(); closeAction(); }
                  }}
                >
                  <label className="attachment-field">
                    新文件名
                    <input
                      className="attachment-input" autoFocus required value={editing.name} disabled={buttonsDisabled}
                      onChange={(event) => setAction({ ...editing, name: event.target.value })}
                    />
                  </label>
                  {showInlineError && <p role="alert" className="attachment-error">{error.message}</p>}
                  <div className="attachment-actions">
                    <button type="submit" className="neu-editor-btn attachment-button attachment-primary"
                      disabled={buttonsDisabled || !editing.name || editing.name === attachment.name}>保存</button>
                    <button type="button" className="neu-editor-btn attachment-button" disabled={buttonsDisabled}
                      onClick={closeAction}>取消</button>
                  </div>
                </form>}
                {editing && editing.kind !== 'rename' && <div className="attachment-inline"
                  role="group" aria-label={editing.kind === 'replace' ? '确认替换内容' : '确认删除附件'}
                >
                  <p>{editing.kind === 'replace'
                    ? '用 ' + editing.file.name + ' 替换 ' + attachment.name + ' 的内容，链接保持不变。'
                    : '删除 ' + attachment.name + '？此操作无法撤销。'}</p>
                  {showInlineError && <p role="alert" className="attachment-error">{error.message}</p>}
                  <div className="attachment-actions">
                    <button
                      type="button" className="neu-editor-btn attachment-button attachment-danger"
                      disabled={buttonsDisabled} onClick={submitAction}
                    >{editing.kind === 'replace' ? '确认替换' : '确认删除'}</button>
                    <button type="button" className="neu-editor-btn attachment-button" disabled={buttonsDisabled}
                      onClick={closeAction}>取消</button>
                  </div>
                </div>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
