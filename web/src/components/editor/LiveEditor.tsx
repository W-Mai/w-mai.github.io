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
  });

  // Fetch post list on mount
  useEffect(() => {
    fetch('/api/editor/posts')
      .then((res) => res.json())
      .then((posts: string[]) => setState((s) => ({ ...s, posts })))
      .catch((err) => setState((s) => ({ ...s, error: err.message })));
  }, []);

  const selectPost = useCallback(async (slug: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/editor/posts/${slug}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load post');
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
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setState((s) => ({
        ...s,
        savedContent: s.content,
        isDirty: false,
        isLoading: false,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, [state.selectedSlug, state.isDirty, state.content]);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

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
        }}>
          Posts
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PostList
            posts={state.posts}
            selectedSlug={state.selectedSlug}
            onSelect={selectPost}
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
            <PreviewPanel mdxContent={state.content} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveEditor;
