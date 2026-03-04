import { useState, useEffect, useCallback, type FC } from 'react';
import PostList from './PostList';
import MdxEditor from './MdxEditor';
import PreviewPanel from './PreviewPanel';

interface LiveEditorState {
  posts: string[];
  selectedSlug: string | null;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  previewKey: number;
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

  // Fetch post list on mount
  useEffect(() => {
    fetch('/api/editor/posts')
      .then((res) => res.json())
      .then((posts: string[]) => setState((s) => ({ ...s, posts })))
      .catch((err) => setState((s) => ({ ...s, error: err.message })));

    // Listen for HMR events when posts are saved to disk
    if (import.meta.hot) {
      import.meta.hot.on('editor:post-updated', (data: { slug: string }) => {
        setState((s) => {
          if (s.selectedSlug === data.slug) {
            return { ...s, previewKey: s.previewKey + 1 };
          }
          return s;
        });
      });
    }

    // Listen for intercepted full-reload events from the page-level script
    const handleHmrReload = () => {
      setState((s) => {
        if (s.selectedSlug) {
          return { ...s, previewKey: s.previewKey + 1 };
        }
        return s;
      });
    };
    window.addEventListener('editor:hmr-reload', handleHmrReload);

    return () => {
      window.removeEventListener('editor:hmr-reload', handleHmrReload);
    };
  }, []);

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
        ...s,
        selectedSlug: slug,
        content,
        savedContent: content,
        isDirty: false,
        isLoading: false,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, []);

  const handleChange = useCallback((value: string) => {
    setState((s) => ({
      ...s,
      content: value,
      isDirty: value !== s.savedContent,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!state.selectedSlug || !state.isDirty) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${state.selectedSlug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: state.content,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Failed to save';
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }
      setState((s) => ({
        ...s,
        savedContent: s.content,
        isDirty: false,
        isLoading: false,
        previewKey: s.previewKey + 1,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, [state.selectedSlug, state.isDirty, state.content]);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const createPost = useCallback(async () => {
    const slug = prompt('Enter new post slug (e.g. my-new-post):');
    if (!slug || !slug.trim()) return;
    const trimmed = slug.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setState((s) => ({ ...s, error: 'Slug can only contain letters, numbers, hyphens and underscores' }));
      return;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${trimmed}`, { method: 'POST' });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(data.error || 'Failed to create post');
      const listRes = await fetch('/api/editor/posts');
      const listText = await listRes.text();
      let posts: string[] = [];
      try { posts = JSON.parse(listText); } catch {}
      setState((s) => ({ ...s, posts, isLoading: false }));
      await selectPost(trimmed);
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, [selectPost]);

  const deletePost = useCallback(async (slug: string) => {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${slug}`, { method: 'DELETE' });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(data.error || 'Failed to delete post');
      const listRes = await fetch('/api/editor/posts');
      const listText = await listRes.text();
      let posts: string[] = [];
      try { posts = JSON.parse(listText); } catch {}
      setState((s) => ({
        ...s,
        posts,
        isLoading: false,
        ...(s.selectedSlug === slug ? {
          selectedSlug: null, content: '', savedContent: '', isDirty: false,
        } : {}),
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, []);

  const [scrollRatio, setScrollRatio] = useState(0);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: '#fff', color: '#111827',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {/* Sidebar */}
      <div style={{
        width: '220px', minWidth: '220px',
        borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column',
        background: '#fafafa',
      }}>
        <div style={{
          padding: '1rem', borderBottom: '1px solid #e5e7eb',
          fontSize: '0.75rem', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          color: '#9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Posts</span>
          <button
            onClick={createPost}
            title="New post"
            style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.25rem',
              cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280',
              padding: '0.1rem 0.4rem', lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PostList
            posts={state.posts}
            selectedSlug={state.selectedSlug}
            onSelect={selectPost}
            onDelete={deletePost}
          />
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa',
          fontSize: '0.875rem',
        }}>
          <span style={{ color: '#6b7280' }}>
            {state.selectedSlug
              ? `${state.selectedSlug}.mdx`
              : 'Select a post to edit'}
          </span>
          {state.isDirty && (
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#111827', display: 'inline-block',
            }} title="Unsaved changes" />
          )}
          <div style={{ flex: 1 }} />
          {state.selectedSlug && (
            <button
              onClick={handleSave}
              disabled={!state.isDirty || state.isLoading}
              style={{
                padding: '0.35rem 1rem',
                background: state.isDirty ? '#111827' : '#e5e7eb',
                color: state.isDirty ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: '0.375rem',
                fontSize: '0.8rem', fontWeight: 500,
                cursor: state.isDirty ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
            >
              {state.isLoading ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>

        {/* Error banner */}
        {state.error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: '#fef2f2', color: '#dc2626',
            fontSize: '0.8rem', borderBottom: '1px solid #fecaca',
          }}>
            <span style={{ flex: 1 }}>{state.error}</span>
            <button
              onClick={dismissError}
              style={{
                background: 'none', border: 'none',
                color: '#dc2626', cursor: 'pointer', fontSize: '1rem',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Editor + Preview split */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #e5e7eb' }}>
            {state.selectedSlug ? (
              <MdxEditor
                content={state.content}
                onChange={handleChange}
                onSave={handleSave}
                onScroll={setScrollRatio}
              />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: '#9ca3af', fontSize: '0.9rem',
              }}>
                ← Select a post from the sidebar
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PreviewPanel slug={state.selectedSlug} refreshKey={state.previewKey} scrollRatio={scrollRatio} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveEditor;
