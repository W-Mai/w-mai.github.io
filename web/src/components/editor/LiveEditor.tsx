import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import AssetPanel from './AssetPanel';
import StickerPanel from './StickerPanel';
import PostList from './PostList';
import MdxEditor, { type MdxEditorHandle } from './MdxEditor';
import PreviewPanel from './PreviewPanel';
import Toolbar from './Toolbar';
import ContextMenu from './ContextMenu';
import CreatePostModal from './CreatePostModal';
import AssetNameDialog from './AssetNameDialog';
import ShortcutPanel from './ShortcutPanel';
import AIDiffPanel from './AIDiffPanel';
import GitCommitModal from './GitCommitModal';
import { EDITOR_TOKENS as T } from './editor-tokens';
import { persistEditorState, restoreEditorState } from '../../lib/editor-utils';
import { setStickerPickerCallback } from '../../lib/editor-autocomplete';
import StickerPicker from './StickerPicker';
import EnvConfigPanel from './EnvConfigPanel';

interface PostInfo {
  slug: string;
  title: string;
  tags: string[];
  category: string;
  pubDate: string;
}

interface LiveEditorState {
  posts: PostInfo[];
  selectedSlug: string | null;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  previewKey: number;
}

interface AIState {
  isActive: boolean;
  isStreaming: boolean;
  originalText: string;
  suggestedText: string;
  selectionFrom: number;
  selectionTo: number;
  position: { top: number; left: number };
  abortController: AbortController | null;
}

const LiveEditor: FC = () => {
  const [state, setState] = useState<LiveEditorState>({
    posts: [],
    selectedSlug: null,
    content: '',
    savedContent: '',
    isDirty: false,
    isLoading: false,
    error: null,
    previewKey: 0,
  });

  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [contextHasSelection, setContextHasSelection] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [assetNames, setAssetNames] = useState<Set<string>>(new Set());
  const [sidebarTab, setSidebarTab] = useState<'posts' | 'assets'>(() => {
    return (restoreEditorState('sidebarTab') as 'posts' | 'assets') || 'posts';
  });
  const [scrollRatio, setScrollRatio] = useState(0);
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const [gitPending, setGitPending] = useState<{ slug: string; title: string; files: string[]; action: 'add' | 'update' | 'delete' }[]>([]);
  const [gitCommitting, setGitCommitting] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [showEnvConfig, setShowEnvConfig] = useState(false);
  const [stickerPicker, setStickerPicker] = useState<{
    pos: { x: number; y: number }; isBlock: boolean;
  } | null>(null);

  const [aiState, setAiState] = useState<AIState>({
    isActive: false, isStreaming: false,
    originalText: '', suggestedText: '',
    selectionFrom: 0, selectionTo: 0,
    position: { top: 0, left: 0 },
    abortController: null,
  });

  const editorRef = useRef<MdxEditorHandle>(null);

  // Register sticker picker callback for autocomplete integration
  useEffect(() => {
    setStickerPickerCallback((pos, isBlock) => {
      setStickerPicker({ pos, isBlock });
    });
    return () => setStickerPickerCallback(null);
  }, []);

  // Check AI availability on mount
  useEffect(() => {
    fetch('/api/editor/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'polish', content: '' }) })
      .then((res) => { setAiEnabled(res.status !== 503); })
      .catch(() => { setAiEnabled(false); });
  }, []);

  // Restore selected slug from localStorage
  useEffect(() => {
    const savedSlug = restoreEditorState('selectedSlug');
    fetch('/api/editor/posts?detail')
      .then((res) => res.json())
      .then((posts: PostInfo[]) => {
        setState((s) => ({ ...s, posts }));
        if (savedSlug && posts.some((p) => p.slug === savedSlug)) {
          selectPost(savedSlug);
        }
      })
      .catch((err) => setState((s) => ({ ...s, error: err.message })));

    // HMR listeners
    if (import.meta.hot) {
      import.meta.hot.on('editor:post-updated', (data: { slug: string }) => {
        setState((s) => s.selectedSlug === data.slug ? { ...s, previewKey: s.previewKey + 1 } : s);
      });
    }
    const handleHmrReload = () => {
      setState((s) => s.selectedSlug ? { ...s, previewKey: s.previewKey + 1 } : s);
    };
    window.addEventListener('editor:hmr-reload', handleHmrReload);
    return () => { window.removeEventListener('editor:hmr-reload', handleHmrReload); };
  }, []);

  // Persist sidebar tab
  useEffect(() => { persistEditorState('sidebarTab', sidebarTab); }, [sidebarTab]);

  // Fetch asset names for upload naming dialog
  const refreshAssetNames = useCallback(() => {
    fetch('/api/editor/assets')
      .then((res) => res.json())
      .then((data: { name: string }[]) => setAssetNames(new Set(data.map((a) => a.name))))
      .catch(() => {});
  }, []);
  useEffect(() => { refreshAssetNames(); }, [refreshAssetNames]);

  // Fetch pending git posts and poll periodically (pause while modal is open)
  const refreshGitPending = useCallback(() => {
    fetch('/api/editor/git')
      .then((res) => res.json())
      .then((data: any) => setGitPending(data.pending || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshGitPending();
    if (showGitModal) return;
    const interval = setInterval(refreshGitPending, 10000);
    return () => clearInterval(interval);
  }, [refreshGitPending, showGitModal]);

  const handleGitCommit = useCallback(() => {
    if (gitPending.length === 0 || gitCommitting) return;
    setShowGitModal(true);
  }, [gitPending, gitCommitting]);

  const handleGitCommitConfirm = useCallback(async (messages: Record<string, string>) => {
    setShowGitModal(false);
    setGitCommitting(true);
    setState((s) => ({ ...s, error: null }));
    try {
      const res = await fetch('/api/editor/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Git commit failed');
      const count = data.committed?.length || 0;
      const names = data.committed?.map((c: any) => c.title).join(', ') || '';
      setState((s) => ({ ...s, error: null }));
      setGitPending([]);
      alert(`Committed ${count} post(s): ${names}`);
    } catch (err: any) {
      setState((s) => ({ ...s, error: `Git: ${err.message}` }));
    } finally {
      setGitCommitting(false);
      refreshGitPending();
    }
  }, [refreshGitPending]);

  const handleFileUpload = useCallback((file: File) => {
    refreshAssetNames();
    setPendingUploadFile(file);
  }, [refreshAssetNames]);

  const handleUploadConfirm = useCallback(async (file: File, finalName: string) => {
    setPendingUploadFile(null);
    try {
      const res = await fetch(`/api/editor/assets/${encodeURIComponent(finalName)}`, {
        method: 'POST', body: file,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed: ${finalName}`);
      }
      const data = await res.json().catch(() => ({ name: finalName }));
      const savedName = data.name || finalName;
      refreshAssetNames();
      editorRef.current?.insertText(`![${savedName}](./assets/${savedName})`);
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message }));
    }
  }, [refreshAssetNames]);

  const selectPost = useCallback(async (slug: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${slug}`);
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Failed to load post';
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }
      const content = await res.text();
      setState((s) => ({
        ...s, selectedSlug: slug, content, savedContent: content,
        isDirty: false, isLoading: false,
      }));
      persistEditorState('selectedSlug', slug);
      setShowFilePanel(false);
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, []);

  const handleChange = useCallback((value: string) => {
    setState((s) => ({ ...s, content: value, isDirty: value !== s.savedContent }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!state.selectedSlug || !state.isDirty) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${state.selectedSlug}`, {
        method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: state.content,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Failed to save';
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }
      setState((s) => ({
        ...s, savedContent: s.content, isDirty: false, isLoading: false, previewKey: s.previewKey + 1,
      }));
      refreshGitPending();
      setAssetRefreshKey((k) => k + 1);
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, [state.selectedSlug, state.isDirty, state.content, refreshGitPending]);

  // Auto-save debounce
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!state.isDirty || !state.selectedSlug) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const slug = state.selectedSlug;
      const content = state.content;
      if (!slug) return;
      fetch(`/api/editor/posts/${slug}`, {
        method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: content,
      }).then((res) => {
        if (res.ok) {
          setState((s) => s.content === content
            ? { ...s, savedContent: content, isDirty: false, previewKey: s.previewKey + 1 }
            : s);
        }
      }).catch(() => {});
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [state.content, state.isDirty, state.selectedSlug]);

  const dismissError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const createPost = useCallback(async (slug: string, title: string) => {
    setShowCreateModal(false);
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(data.error || 'Failed to create post');
      const listRes = await fetch('/api/editor/posts?detail');
      const posts: PostInfo[] = await listRes.json();
      setState((s) => ({ ...s, posts, isLoading: false }));
      await selectPost(slug);
      refreshGitPending();
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, [selectPost, refreshGitPending]);

  const deletePost = useCallback(async (slug: string) => {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${slug}`, { method: 'DELETE' });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(data.error || 'Failed to delete post');
      const listRes = await fetch('/api/editor/posts?detail');
      const posts: PostInfo[] = await listRes.json();
      setState((s) => ({
        ...s, posts, isLoading: false,
        ...(s.selectedSlug === slug ? { selectedSlug: null, content: '', savedContent: '', isDirty: false } : {}),
      }));
      refreshGitPending();
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, [refreshGitPending]);

  const handleInsertAsset = useCallback((ref: string) => {
    const imgTag = `![](${ref})`;
    navigator.clipboard.writeText(imgTag);
    setState((s) => ({ ...s, error: null }));
  }, []);

  const handleContextMenu = useCallback((e: { x: number; y: number; hasSelection: boolean }) => {
    setContextMenu({ x: e.x, y: e.y });
    setContextHasSelection(e.hasSelection);
  }, []);

  // AI action handler
  const handleAIAction = useCallback(async (action: string) => {
    const view = editorRef.current?.getView();
    if (!view) return;

    const { from, to } = view.state.selection.main;
    if (from === to) return;

    const selectedText = view.state.sliceDoc(from, to);
    const doc = view.state.doc.toString();
    const contextBefore = doc.slice(Math.max(0, from - 500), from);
    const contextAfter = doc.slice(to, Math.min(doc.length, to + 500));

    const abortController = new AbortController();

    // Position diff panel near selection
    const coords = view.coordsAtPos(from);
    const editorRect = view.dom.getBoundingClientRect();
    const panelTop = (coords?.top ?? editorRect.top) - editorRect.top + 30;
    const panelLeft = Math.min((coords?.left ?? editorRect.left) - editorRect.left, editorRect.width - 420);

    setAiState({
      isActive: true, isStreaming: true,
      originalText: selectedText, suggestedText: '',
      selectionFrom: from, selectionTo: to,
      position: { top: panelTop, left: Math.max(0, panelLeft) },
      abortController,
    });

    try {
      const aiAction = action.replace('ai-', '');
      const res = await fetch('/api/editor/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: aiAction,
          content: selectedText,
          context: `${contextBefore}[SELECTED]${contextAfter}`,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'AI request failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.chunk) {
                  fullText += parsed.chunk;
                  setAiState((s) => ({ ...s, suggestedText: fullText }));
                } else if (parsed.result) {
                  fullText = parsed.result;
                  setAiState((s) => ({ ...s, suggestedText: fullText, isStreaming: false }));
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('JSON')) throw e;
              }
            }
          }
        }
      }

      setAiState((s) => ({ ...s, isStreaming: false }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setState((s) => ({ ...s, error: `AI: ${err.message}` }));
      setAiState((s) => ({ ...s, isActive: false, isStreaming: false }));
    }
  }, []);

  const handleAIAccept = useCallback(() => {
    const view = editorRef.current?.getView();
    if (!view) return;
    view.dispatch({
      changes: { from: aiState.selectionFrom, to: aiState.selectionTo, insert: aiState.suggestedText },
    });
    setAiState((s) => ({ ...s, isActive: false, abortController: null }));
  }, [aiState.selectionFrom, aiState.selectionTo, aiState.suggestedText]);

  const handleAIReject = useCallback(() => {
    setAiState((s) => ({ ...s, isActive: false, abortController: null }));
  }, []);

  const handleAICancel = useCallback(() => {
    aiState.abortController?.abort();
    setAiState((s) => ({ ...s, isActive: false, isStreaming: false, abortController: null }));
  }, [aiState.abortController]);

  // Context menu action dispatcher
  const handleContextAction = useCallback((action: string) => {
    const view = editorRef.current?.getView();
    if (!view) return;

    if (action.startsWith('ai-')) {
      handleAIAction(action);
      return;
    }

    switch (action) {
      case 'cut':
        document.execCommand('cut');
        break;
      case 'copy':
        document.execCommand('copy');
        break;
      case 'paste':
        navigator.clipboard.readText().then((text) => {
          const { from, to } = view.state.selection.main;
          view.dispatch({ changes: { from, to, insert: text } });
        }).catch(() => {});
        break;
      case 'insert-image':
        import('../../lib/editor-formatting').then(({ FORMAT_ACTIONS }) => { FORMAT_ACTIONS.image(view); view.focus(); });
        break;
      case 'insert-link':
        import('../../lib/editor-formatting').then(({ FORMAT_ACTIONS }) => { FORMAT_ACTIONS.link(view); view.focus(); });
        break;
      case 'insert-code-block':
        import('../../lib/editor-formatting').then(({ FORMAT_ACTIONS }) => { FORMAT_ACTIONS['code-block'](view); view.focus(); });
        break;
      case 'insert-table':
        import('../../lib/editor-formatting').then(({ insertBlock }) => {
          insertBlock(view, '| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |');
          view.focus();
        });
        break;
      case 'insert-frontmatter':
        import('../../lib/editor-formatting').then(({ insertBlock }) => {
          insertBlock(view, '---\ntitle: ""\ndescription: ""\npubDate: ""\nheroImage: ""\n---');
          view.focus();
        });
        break;
      case 'insert-sticker':
        setShowStickerPanel(true);
        break;
    }
  }, [handleAIAction]);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: T.colorBg, color: T.colorText, fontFamily: T.fontSans,
    }}>
      {/* Editor animation keyframes */}
      <style>{`
        @keyframes editorOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes editorPanelIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes editorPanelItemIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .editor-overlay {
          animation: editorOverlayIn 0.2s ease both;
        }
        .editor-panel {
          animation: editorPanelIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .editor-btn:hover {
          box-shadow: ${T.shadowBtnHover} !important;
          transform: translateY(1px);
        }
        .editor-btn:active {
          box-shadow: ${T.shadowInset} !important;
          transform: translateY(0);
        }
      `}</style>

      {/* Main area — full width */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: T.spacingLg,
          padding: `${T.spacingMd} ${T.spacingXl}`,
          borderBottom: 'none',
          background: T.colorBg, fontSize: T.fontSizeBase,
          boxShadow: T.shadowRaised,
        }}>
          <button
            className="editor-btn"
            onClick={() => setShowFilePanel(true)}
            title="Open file panel"
            style={{
              background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
              cursor: 'pointer', fontSize: T.fontSizeMd, color: T.colorTextSecondary,
              padding: `0.25rem ${T.spacingSm}`,
              boxShadow: T.shadowBtn,
              transition: `all ${T.transitionFast}`,
            }}
          >
            📝
          </button>
          <span style={{ color: T.colorTextSecondary }}>
            {state.selectedSlug ? `${state.selectedSlug}.mdx` : 'Select a post to edit'}
          </span>
          {state.isDirty && (
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: T.colorAccent, display: 'inline-block',
            }} title="Unsaved changes" />
          )}
          <div style={{ flex: 1 }} />
          {state.selectedSlug && (
            <button
              className="editor-btn"
              onClick={handleSave}
              disabled={!state.isDirty || state.isLoading}
              style={{
                padding: `0.35rem ${T.spacingXl}`,
                background: state.isDirty ? T.colorAccent : T.colorBg,
                color: state.isDirty ? '#ffffff' : T.colorTextMuted,
                border: 'none', borderRadius: T.radiusMd,
                fontSize: T.fontSizeMd, fontWeight: 500,
                cursor: state.isDirty ? 'pointer' : 'default',
                transition: `all ${T.transitionFast}`,
                boxShadow: state.isDirty ? T.shadowBtn : 'none',
              }}
            >
              {state.isLoading ? 'Saving...' : 'Save'}
            </button>
          )}
          <button
            className="editor-btn"
            onClick={handleGitCommit}
            disabled={gitCommitting || gitPending.length === 0}
            title={gitPending.length > 0
              ? `Commit ${gitPending.length} post(s): ${gitPending.map((p) => p.title).join(', ')}`
              : 'No pending posts to commit'}
            style={{
              padding: `0.35rem ${T.spacingXl}`,
              background: gitPending.length === 0 ? T.colorBg
                : gitCommitting ? T.colorBg : '#059669',
              color: gitPending.length === 0 ? T.colorTextMuted
                : gitCommitting ? T.colorTextMuted : '#fff',
              border: 'none', borderRadius: T.radiusMd,
              fontSize: T.fontSizeMd, fontWeight: 500,
              cursor: gitPending.length === 0 || gitCommitting ? 'default' : 'pointer',
              transition: `all ${T.transitionFast}`,
              display: 'flex', alignItems: 'center', gap: T.spacingSm,
              opacity: gitPending.length === 0 ? 0.5 : 1,
              boxShadow: gitPending.length > 0 && !gitCommitting ? T.shadowBtn : 'none',
            }}
          >
            {gitCommitting ? '⏳ Committing...' : `📦 Commit${gitPending.length > 0 ? ` ${gitPending.length} post${gitPending.length > 1 ? 's' : ''}` : ''}`}
          </button>
          <button
            className="editor-btn"
            onClick={() => setShowEnvConfig(true)}
            title="Environment variables"
            style={{
              padding: `0.35rem ${T.spacingSm}`,
              background: T.colorBg, border: 'none',
              borderRadius: T.radiusMd, cursor: 'pointer',
              fontSize: T.fontSizeMd, color: T.colorTextSecondary,
              boxShadow: T.shadowBtn,
              transition: `all ${T.transitionFast}`,
            }}
          >
            ⚙️
          </button>
        </div>

        {/* Error banner */}
        {state.error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: T.spacingMd,
            padding: `${T.spacingMd} ${T.spacingXl}`,
            background: T.colorErrorBg, color: T.colorError,
            fontSize: T.fontSizeMd, borderBottom: '1px solid #fecaca',
          }}>
            <span style={{ flex: 1 }}>{state.error}</span>
            <button
              onClick={dismissError}
              style={{ background: 'none', border: 'none', color: T.colorError, cursor: 'pointer', fontSize: T.fontSizeBase }}
            >×</button>
          </div>
        )}

        {/* Toolbar */}
        {state.selectedSlug && (
          <Toolbar editorView={editorRef.current?.getView() ?? null} activeFormats={activeFormats} onStickerOpen={() => setShowStickerPanel(true)} />
        )}

        {/* Editor + Preview split */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, borderRight: `1px solid ${T.colorBorder}`, position: 'relative' }}>
            {state.selectedSlug ? (
              <MdxEditor
                ref={editorRef}
                content={state.content}
                onChange={handleChange}
                onSave={handleSave}
                onScroll={setScrollRatio}
                onActiveFormatsChange={setActiveFormats}
                onContextMenu={handleContextMenu}
                onShowShortcuts={() => setShowShortcuts(true)}
                onFileUpload={handleFileUpload}
                onStickerOpen={() => setShowStickerPanel(true)}
              />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: T.colorTextMuted, fontSize: '0.9rem',
              }}>
                ← Select a post from the sidebar
              </div>
            )}

            {/* AI Diff Panel */}
            {aiState.isActive && (
              <AIDiffPanel
                originalText={aiState.originalText}
                suggestedText={aiState.suggestedText}
                isStreaming={aiState.isStreaming}
                position={aiState.position}
                onAccept={handleAIAccept}
                onReject={handleAIReject}
                onCancel={handleAICancel}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PreviewPanel slug={state.selectedSlug} refreshKey={state.previewKey} scrollRatio={scrollRatio} />
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        position={contextMenu}
        hasSelection={contextHasSelection}
        aiEnabled={aiEnabled}
        onAction={handleContextAction}
        onClose={() => setContextMenu(null)}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        existingSlugs={state.posts.map((p) => p.slug)}
        aiEnabled={aiEnabled}
        onConfirm={createPost}
        onCancel={() => setShowCreateModal(false)}
      />

      {/* Asset Upload Naming Dialog (for editor drag/paste) */}
      <AssetNameDialog
        file={pendingUploadFile}
        aiEnabled={aiEnabled}
        existingNames={assetNames}
        onConfirm={handleUploadConfirm}
        onCancel={() => setPendingUploadFile(null)}
      />

      {/* Shortcut Panel */}
      <ShortcutPanel isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Git Commit Modal */}
      <GitCommitModal
        isOpen={showGitModal}
        pending={gitPending}
        aiEnabled={aiEnabled}
        onCommit={handleGitCommitConfirm}
        onCancel={() => setShowGitModal(false)}
      />

      {/* Sticker Picker */}
      <StickerPanel
        isOpen={showStickerPanel}
        onClose={() => setShowStickerPanel(false)}
        onInsertInline={(syntax) => editorRef.current?.insertText(syntax)}
        onInsertBlock={(syntax) => editorRef.current?.insertText(syntax)}
      />

      {/* Inline sticker grid picker (from autocomplete) */}
      {stickerPicker && (
        <StickerPicker
          position={stickerPicker.pos}
          onSelect={(name) => {
            const suffix = stickerPicker.isBlock ? ']::' : ']:';
            editorRef.current?.insertText(name + suffix);
            setStickerPicker(null);
            editorRef.current?.getView()?.focus();
          }}
          onClose={() => setStickerPicker(null)}
        />
      )}

      {/* Env Config Panel */}
      <EnvConfigPanel isOpen={showEnvConfig} onClose={() => setShowEnvConfig(false)} />

      {/* File Panel Overlay */}
      {showFilePanel && (
        <div
          className="editor-overlay"
          onClick={() => setShowFilePanel(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="editor-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '520px', maxWidth: '90vw', maxHeight: '80vh',
              background: T.colorBg, borderRadius: T.radiusLg,
              boxShadow: T.shadowRaised,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Panel header with tabs */}
            <div style={{
              display: 'flex', alignItems: 'center',
              borderBottom: `1px solid ${T.colorBorder}`,
            }}>
              <div style={{ display: 'flex', flex: 1 }}>
                {(['posts', 'assets'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSidebarTab(tab)}
                    style={{
                      flex: 1, padding: `0.75rem ${T.spacingMd}`,
                      background: 'none', border: 'none',
                      borderBottom: sidebarTab === tab ? `2px solid ${T.colorAccent}` : '2px solid transparent',
                      fontSize: T.fontSizeSm, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: sidebarTab === tab ? T.colorText : T.colorTextMuted,
                      cursor: 'pointer', transition: `all ${T.transitionFast}`,
                    }}
                  >
                    {tab === 'posts' ? '📝 Posts' : '🖼 Assets'}
                  </button>
                ))}
              </div>
              {sidebarTab === 'posts' && (
                <button
                  onClick={() => { setShowFilePanel(false); setShowCreateModal(true); }}
                  title="New post"
                  style={{
                    background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                    cursor: 'pointer', fontSize: T.fontSizeMd, color: T.colorTextSecondary,
                    padding: `0.2rem 0.5rem`, marginRight: T.spacingMd, lineHeight: 1,
                    boxShadow: T.shadowBtn,
                    transition: `all ${T.transitionFast}`,
                  }}
                >
                  +
                </button>
              )}
              <button
                onClick={() => setShowFilePanel(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.colorTextMuted, fontSize: T.fontSizeBase,
                  padding: `0.5rem ${T.spacingMd}`,
                }}
              >
                ✕
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {sidebarTab === 'posts' ? (
                <PostList
                  posts={state.posts}
                  selectedSlug={state.selectedSlug}
                  onSelect={selectPost}
                  onDelete={deletePost}
                />
              ) : (
                <AssetPanel aiEnabled={aiEnabled} refreshKey={assetRefreshKey} onInsert={handleInsertAsset} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveEditor;
