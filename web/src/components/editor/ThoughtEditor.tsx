import { useState, useRef, useCallback, type FC } from 'react';
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: `${T.spacingSm} ${T.spacingMd}`,
    border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
    fontSize: T.fontSizeSm, background: T.colorBgSecondary,
    color: T.colorText, outline: 'none', boxSizing: 'border-box',
    fontFamily: T.fontSans,
  };

  return (
    <div style={{
      boxShadow: T.shadowInset, borderRadius: T.radiusLg,
      padding: T.spacingXl, fontFamily: T.fontSans,
      background: T.colorBg,
    }}>
      <div style={{ fontSize: T.fontSizeSm, fontWeight: 600, color: T.colorText, marginBottom: T.spacingMd }}>
        {editingId ? '✏️ Edit thought' : '💭 New thought'}
      </div>

      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write something..."
        rows={3}
        style={{
          ...inputStyle,
          resize: 'vertical', minHeight: '4rem',
          fontFamily: T.fontSans, lineHeight: '1.6',
        }}
      />

      {/* Tag + Mood row */}
      <div style={{ display: 'flex', gap: T.spacingSm, marginTop: T.spacingSm, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Tags (comma separated)"
          style={{ ...inputStyle, flex: 1, minWidth: '120px' }}
        />
        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(mood === m ? '' : m)}
              style={{
                background: mood === m ? T.colorAccent : 'transparent',
                border: `1px solid ${mood === m ? T.colorAccent : T.colorBorderLight}`,
                borderRadius: T.radiusSm, padding: '2px 6px',
                fontSize: T.fontSizeSm, cursor: 'pointer',
                transition: `all ${T.transitionFast}`,
                filter: mood === m ? 'none' : 'grayscale(0.5)',
              }}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {content.trim() && (
        <div style={{
          marginTop: T.spacingMd, padding: T.spacingMd,
          borderRadius: T.radiusSm, background: T.colorBgSecondary,
          fontSize: T.fontSizeSm, color: T.colorText, lineHeight: '1.6',
        }}>
          <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: T.spacingXs }}>Preview</div>
          <div className="thought-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: T.colorError, fontSize: T.fontSizeXs, marginTop: T.spacingSm }}>{error}</div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: T.spacingSm, marginTop: T.spacingMd, justifyContent: 'flex-end' }}>
        <button
          onClick={() => setStickerOpen(true)}
          style={{
            padding: `${T.spacingSm} ${T.spacingMd}`,
            background: 'none', border: `1px solid ${T.colorBorder}`,
            borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
            color: T.colorTextSecondary, cursor: 'pointer',
          }}
        >😀 Sticker</button>

        {editingId && (
          <button
            onClick={resetForm}
            style={{
              padding: `${T.spacingSm} ${T.spacingMd}`,
              background: 'none', border: `1px solid ${T.colorBorder}`,
              borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
              color: T.colorTextSecondary, cursor: 'pointer',
            }}
          >Cancel</button>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          style={{
            padding: `${T.spacingSm} ${T.spacingLg}`,
            background: !content.trim() ? T.colorBorder : T.colorAccent,
            color: !content.trim() ? T.colorTextMuted : T.colorBg,
            border: 'none', borderRadius: T.radiusSm,
            fontSize: T.fontSizeSm, fontWeight: 500,
            cursor: !content.trim() ? 'default' : 'pointer',
            transition: `all ${T.transitionFast}`,
          }}
        >{saving ? 'Saving...' : editingId ? 'Update' : 'Post'}</button>
      </div>

      <StickerPanel
        isOpen={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onInsertInline={(syntax) => insertSticker(syntax)}
      />
    </div>
  );
};

export default ThoughtEditor;
