/**
 * ThoughtEditor — create/edit thoughts with live preview, AI tag suggestion,
 * sticker insertion, mood picker, and git commit integration.
 */

import { useRef, useCallback, useEffect, type FC } from 'react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { EDITOR_TOKENS as T } from '../editor-tokens';
import { useThoughtDraft } from './use-draft';
import { useThoughtApi } from './use-api';
import ThoughtPreview from './Preview';
import StickerPanel from '../StickerPanel';

interface ThoughtData {
  id: string;
  content: string;
  createdAt: string;
  tags?: string[];
  mood?: string;
}

interface ThoughtEditorProps {
  onSaved?: () => void;
  allTags?: string[];
}

const MOOD_OPTIONS = ['🎉', '🤔', '✨', '😤', '🐛', '💡', '🔥', '😂', '🥲', '👀'];

/** Inset input style — sunken into the raised card */
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

const ThoughtEditor: FC<ThoughtEditorProps> = ({ onSaved, allTags = [] }) => {
  const draft = useThoughtDraft();
  const api = useThoughtApi(onSaved);
  const [stickerOpen, setStickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Trigger debounced preview on content change
  useEffect(() => { api.updatePreview(draft.content); }, [draft.content]);

  const parsedTags = draft.tagInput.split(',').map(t => t.trim()).filter(Boolean);

  const handleSave = useCallback(async () => {
    const ok = await api.save({
      content: draft.content,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      mood: draft.mood || undefined,
      editingId: draft.editingId,
    });
    if (ok) draft.reset();
  }, [draft.content, draft.tagInput, draft.mood, draft.editingId, api, parsedTags]);

  const handleSuggestTags = useCallback(async () => {
    const result = await api.suggestTags(draft.content, parsedTags, allTags);
    if (result) {
      draft.update({ tagInput: result.tags.join(', ') });
      if (result.mood && !draft.mood) draft.update({ mood: result.mood });
    }
  }, [draft.content, parsedTags, allTags, draft.mood, api]);

  const insertSticker = useCallback((syntax: string) => {
    const ta = textareaRef.current;
    if (!ta) { draft.update({ content: draft.content + syntax }); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = draft.content.slice(0, start) + syntax + draft.content.slice(end);
    draft.update({ content: next });
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + syntax.length;
      ta.focus();
    });
  }, [draft.content]);

  const startEdit = useCallback((thought: ThoughtData) => {
    draft.update({
      content: thought.content,
      tagInput: thought.tags?.join(', ') ?? '',
      mood: thought.mood ?? '',
      editingId: thought.id,
    });
    api.clearError();
    textareaRef.current?.focus();
  }, [api]);

  const handleDelete = useCallback(async (id: string) => {
    await api.remove(id);
  }, [api]);

  const handleCancel = useCallback(() => {
    draft.reset();
    api.clearError();
  }, [draft, api]);

  // Expose edit/delete to page-level JS
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__thoughtEditor = { startEdit, handleDelete };
    }
  }, [startEdit, handleDelete]);

  const hasContent = !!draft.content.trim();

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
        {draft.editingId ? '✏️ Edit thought' : '💭 New thought'}
      </div>

      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        value={draft.content}
        onChange={(e) => draft.update({ content: e.target.value })}
        placeholder="Write something..."
        rows={4}
        style={{ ...insetInput, resize: 'vertical', minHeight: '5rem', lineHeight: '1.7' }}
      />

      {/* Tag input + AI button + Mood row */}
      <div style={{
        display: 'flex', gap: T.spacingMd,
        marginTop: T.spacingLg,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <input
          type="text"
          value={draft.tagInput}
          onChange={(e) => draft.update({ tagInput: e.target.value })}
          placeholder="Tags (comma separated)"
          style={{ ...insetInput, flex: 1, minWidth: '140px' }}
        />
        <button
          onClick={handleSuggestTags}
          disabled={api.suggestingTags || !hasContent}
          className="neu-editor-btn"
          style={{
            padding: `${T.spacingSm} ${T.spacingMd}`,
            fontSize: T.fontSizeSm,
            opacity: hasContent ? 1 : 0.5,
          }}
          title="AI suggest tags"
        >{api.suggestingTags ? '...' : '🤖'}</button>

        <div className="neu-mood-capsule">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m}
              className={`neu-mood-item${draft.mood === m ? ' selected' : ''}`}
              onClick={() => draft.update({ mood: draft.mood === m ? '' : m })}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Live preview — portaled into timeline */}
      <ThoughtPreview
        content={draft.content}
        tagInput={draft.tagInput}
        mood={draft.mood}
        previewHtml={api.previewHtml}
      />

      {/* Error */}
      {api.error && (
        <div style={{
          color: T.colorError, fontSize: T.fontSizeXs,
          marginTop: T.spacingMd, padding: `${T.spacingSm} ${T.spacingMd}`,
          borderRadius: T.radiusSm, background: T.colorErrorBg,
        }}>{api.error}</div>
      )}

      {/* Action bar */}
      <div style={{
        display: 'flex', gap: T.spacingMd,
        marginTop: T.spacingLg, justifyContent: 'flex-end',
        alignItems: 'center',
      }}>
        {api.commitResult && (
          <span style={{
            fontSize: T.fontSizeXs, color: T.colorTextMuted,
            marginRight: 'auto', maxWidth: '60%', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={api.commitResult}>{api.commitResult}</span>
        )}

        <button
          onClick={api.commit}
          disabled={api.committing || !api.hasPending}
          className="neu-editor-btn"
          style={{ opacity: api.hasPending ? 1 : 0.5 }}
          title="Git commit thoughts"
        >{api.committing ? '...' : '📦 Commit'}</button>

        <button onClick={() => setStickerOpen(true)} className="neu-editor-btn">
          😀 Sticker
        </button>

        {draft.editingId && (
          <button onClick={handleCancel} className="neu-editor-btn">Cancel</button>
        )}

        <button
          onClick={handleSave}
          disabled={api.saving || !hasContent}
          className="neu-editor-btn neu-editor-btn-primary"
          style={{ opacity: hasContent ? 1 : 0.6 }}
        >{api.saving ? 'Saving...' : draft.editingId ? 'Update' : 'Post'}</button>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <StickerPanel
          isOpen={stickerOpen}
          onClose={() => setStickerOpen(false)}
          onInsertInline={(syntax) => insertSticker(syntax)}
          onInsertBlock={(syntax) => insertSticker(syntax)}
        />,
        document.body,
      )}
    </div>
  );
};

export default ThoughtEditor;
