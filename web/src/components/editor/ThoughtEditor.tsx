import { useState, useRef, useCallback, type FC } from 'react';
import { createPortal } from 'react-dom';
import { EDITOR_TOKENS as T } from './editor-tokens';
import StickerPanel from './StickerPanel';
import { renderInlineMarkdown } from '../../lib/markdown';

interface ThoughtData {
  id: string;
  content: string;
  createdAt: string;
  tags?: string[];
  mood?: string;
}

interface ThoughtEditorProps {
  onSaved?: () => void;
}

const MOOD_OPTIONS = ['🎉', '🤔', '✨', '😤', '🐛', '💡', '🔥', '😂', '🥲', '👀'];

const ThoughtEditor: FC<ThoughtEditorProps> = ({ onSaved }) => {
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [mood, setMood] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const previewHtml = content ? renderInlineMarkdown(content) : '';

  const resetForm = () => {
    setContent('');
    setTagInput('');
    setMood('');
    setEditingId(null);
    setError(null);
  };

  const handleSave = useCallback(async () => {
    if (!content.trim()) { setError('Content is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
      const body = { content: content.trim(), tags: tags.length > 0 ? tags : undefined, mood: mood || undefined };

      const url = editingId ? `/api/editor/thoughts/${editingId}` : '/api/editor/thoughts';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      resetForm();
      if (onSaved) onSaved();
      else window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [content, tagInput, mood, editingId, onSaved]);

  const insertSticker = useCallback((syntax: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent((prev) => prev + syntax); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    setContent(before + syntax + after);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + syntax.length;
      ta.focus();
    });
  }, [content]);

  const startEdit = useCallback((thought: ThoughtData) => {
    setContent(thought.content);
    setTagInput(thought.tags?.join(', ') ?? '');
    setMood(thought.mood ?? '');
    setEditingId(thought.id);
    setError(null);
    textareaRef.current?.focus();
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this thought?')) return;
    try {
      const res = await fetch(`/api/editor/thoughts/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      if (onSaved) onSaved();
      else window.location.reload();
    } catch (err: any) {
      setError(err.message);
    }
  }, [onSaved]);

  // Expose edit/delete to page-level JS via custom events
  if (typeof window !== 'undefined') {
    (window as any).__thoughtEditor = { startEdit, handleDelete };
  }

  // Inset input fields — sunken into the raised card
  const insetInput: React.CSSProperties = {
    width: '100%',
    padding: `${T.spacingMd} ${T.spacingLg}`,
    border: 'none',
    borderRadius: T.radiusMd,
    fontSize: T.fontSizeSm,
    background: T.colorBg,
    color: T.colorText,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: T.shadowInset,
    fontFamily: T.fontSans,
  };

  // Neumorphism button base
  const neuBtn = (active = false): React.CSSProperties => ({
    padding: `${T.spacingSm} ${T.spacingLg}`,
    background: T.colorBg,
    border: 'none',
    borderRadius: T.radiusSm,
    fontSize: T.fontSizeSm,
    color: T.colorTextSecondary,
    cursor: 'pointer',
    boxShadow: active ? T.shadowInset : T.shadowBtn,
    transition: `all ${T.transitionFast}`,
  });

  return (
    <div style={{
      boxShadow: T.shadowRaised,
      borderRadius: T.radiusXl,
      padding: T.spacing3xl,
      fontFamily: T.fontSans,
      background: T.colorBg,
    }}>
      {/* Header */}
      <div style={{
        fontSize: T.fontSizeMd, fontWeight: 600,
        color: T.colorAccent, marginBottom: T.spacingLg,
      }}>
        {editingId ? '✏️ Edit thought' : '💭 New thought'}
      </div>

      {/* Content textarea — inset */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write something..."
        rows={4}
        style={{
          ...insetInput,
          resize: 'vertical',
          minHeight: '5rem',
          lineHeight: '1.7',
        }}
      />

      {/* Tag input + Mood row */}
      <div style={{
        display: 'flex', gap: T.spacingMd,
        marginTop: T.spacingLg,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Tags (comma separated)"
          style={{ ...insetInput, flex: 1, minWidth: '140px' }}
        />

        {/* Mood selector — neumorphism capsule */}
        <div className="neu-mood-capsule">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m}
              className={`neu-mood-item${mood === m ? ' selected' : ''}`}
              onClick={() => setMood(mood === m ? '' : m)}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Preview — inset container */}
      {content.trim() && (
        <div style={{
          marginTop: T.spacingLg,
          padding: T.spacingLg,
          borderRadius: T.radiusMd,
          boxShadow: T.shadowInset,
          background: T.colorBg,
          fontSize: T.fontSizeSm,
          color: T.colorText,
          lineHeight: '1.7',
        }}>
          <div style={{
            fontSize: T.fontSizeXs, color: T.colorTextMuted,
            marginBottom: T.spacingSm, fontWeight: 500,
          }}>Preview</div>
          <div className="thought-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          color: T.colorError, fontSize: T.fontSizeXs,
          marginTop: T.spacingMd, padding: `${T.spacingSm} ${T.spacingMd}`,
          borderRadius: T.radiusSm, background: T.colorErrorBg,
        }}>{error}</div>
      )}

      {/* Actions — raised buttons */}
      <div style={{
        display: 'flex', gap: T.spacingMd,
        marginTop: T.spacingLg, justifyContent: 'flex-end',
      }}>
        <button
          onClick={() => setStickerOpen(true)}
          style={neuBtn()}
        >😀 Sticker</button>

        {editingId && (
          <button onClick={resetForm} style={neuBtn()}>
            Cancel
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          style={{
            ...neuBtn(),
            fontWeight: 600,
            color: !content.trim() ? T.colorTextMuted : T.colorAccent,
            opacity: !content.trim() ? 0.6 : 1,
          }}
        >{saving ? 'Saving...' : editingId ? 'Update' : 'Post'}</button>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <StickerPanel
          isOpen={stickerOpen}
          onClose={() => setStickerOpen(false)}
          onInsertInline={(syntax) => insertSticker(syntax)}
        />,
        document.body,
      )}
    </div>
  );
};

export default ThoughtEditor;
