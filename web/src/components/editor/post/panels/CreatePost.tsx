import { useState, useEffect, useRef, useCallback, type FC } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import { validatePostSlug } from '../../../../lib/editor-utils';
import { EDITOR_TOKENS as T } from '../../shared/editor-tokens';

interface CreatePostModalProps {
  isOpen: boolean;
  existingSlugs: string[];
  aiEnabled: boolean;
  onConfirm: (slug: string, title: string) => void;
  onCancel: () => void;
}

/** Convert a title to a URL-friendly slug using pinyin for CJK characters */
function titleToSlug(title: string): string {
  const py = pinyin(title, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return py
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const CreatePostModal: FC<CreatePostModalProps> = ({
  isOpen, existingSlugs, aiEnabled, onConfirm, onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSlug('');
      setSlugManuallyEdited(false);
      setAiSuggestions([]);
      setAiLoading(false);
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const validate = useCallback((value: string): string | null => {
    if (!value) return null;
    const result = validatePostSlug(value);
    if (!result.valid) return result.error || 'Invalid slug';
    if (existingSlugs.includes(value)) return 'This slug already exists';
    return null;
  }, [existingSlugs]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManuallyEdited && value.trim()) {
      const generated = titleToSlug(value);
      setSlug(generated);
      setError(validate(generated));
    }
    if (!value.trim()) {
      setSlug('');
      setError(null);
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
    setError(validate(value));
  };

  const handleAIGenerate = async () => {
    if (!title.trim() || aiLoading) return;
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch('/api/editor/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest-slugs', content: title }),
      });
      if (!res.ok) throw new Error('AI request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

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
              if (parsed.chunk) fullText += parsed.chunk;
              if (parsed.result) fullText = parsed.result;
            } catch {}
          }
        }
      }

      // Parse JSON array from AI response
      const match = fullText.match(/\[[\s\S]*?\]/);
      if (match) {
        const slugs: string[] = JSON.parse(match[0]);
        const valid = slugs.filter((s) => typeof s === 'string' && validatePostSlug(s).valid);
        setAiSuggestions(valid.slice(0, 3));
        if (valid.length > 0) {
          setSlug(valid[0]);
          setSlugManuallyEdited(true);
          setError(validate(valid[0]));
        }
      }
    } catch {
      setError('AI slug generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const selectSuggestion = (s: string) => {
    setSlug(s);
    setSlugManuallyEdited(true);
    setError(validate(s));
  };

  const handleSubmit = () => {
    const err = validate(slug);
    if (err || !slug) { setError(err || 'Slug is required'); return; }
    onConfirm(slug, title);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !error && slug) handleSubmit();
    if (e.key === 'Escape') onCancel();
  };

  if (!isOpen) return null;

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%', padding: `${T.spacingSm} ${T.spacingMd}`,
    border: `1px solid ${hasError ? T.colorError : T.colorBorder}`,
    borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
    outline: 'none', boxSizing: 'border-box',
    transition: `border-color ${T.transitionFast}`,
  });

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.3)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: T.colorBg, borderRadius: T.radiusLg,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: T.spacingXl, width: '400px',
        fontFamily: T.fontSans,
      }}>
        <div style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText, marginBottom: T.spacingLg }}>
          New Post
        </div>

        {/* Title input */}
        <label style={{ fontSize: T.fontSizeXs, color: T.colorTextSecondary, fontWeight: 500 }}>
          Title
        </label>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 今天的遭遇"
          style={{ ...inputStyle(false), marginTop: T.spacingXs, marginBottom: T.spacingLg }}
        />

        {/* Slug input with AI button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingSm, marginBottom: T.spacingXs }}>
          <label style={{ fontSize: T.fontSizeXs, color: T.colorTextSecondary, fontWeight: 500 }}>
            Slug
          </label>
          {aiEnabled && title.trim() && (
            <button
              onClick={handleAIGenerate}
              disabled={aiLoading}
              title="Use AI to generate slug"
              style={{
                background: 'none', border: `1px solid ${T.colorBorder}`,
                borderRadius: T.radiusSm, padding: '0 0.4rem',
                fontSize: T.fontSizeXs, color: aiLoading ? T.colorTextMuted : T.colorAccent,
                cursor: aiLoading ? 'wait' : 'pointer', lineHeight: '1.6',
                transition: `all ${T.transitionFast}`,
              }}
            >
              {aiLoading ? '⏳ Generating...' : '✨ AI'}
            </button>
          )}
        </div>
        <input
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="auto-generated-from-title"
          style={{ ...inputStyle(!!error), fontFamily: T.fontMono }}
        />

        {/* AI suggestions */}
        {aiSuggestions.length > 1 && (
          <div style={{ display: 'flex', gap: T.spacingSm, flexWrap: 'wrap', marginTop: T.spacingSm }}>
            {aiSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => selectSuggestion(s)}
                style={{
                  background: slug === s ? T.colorAccent : T.colorBgTertiary,
                  color: slug === s ? T.colorBg : T.colorTextSecondary,
                  border: 'none', borderRadius: T.radiusSm,
                  padding: `0.15rem ${T.spacingMd}`,
                  fontSize: T.fontSizeXs, fontFamily: T.fontMono,
                  cursor: 'pointer', transition: `all ${T.transitionFast}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ color: T.colorError, fontSize: T.fontSizeXs, marginTop: T.spacingXs }}>
            {error}
          </div>
        )}

        {slug && !error && (
          <div style={{ color: T.colorTextMuted, fontSize: T.fontSizeXs, marginTop: T.spacingXs }}>
            /blog/{slug}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: T.spacingMd, marginTop: T.spacingLg }}>
          <button
            onClick={onCancel}
            style={{
              padding: `${T.spacingSm} ${T.spacingLg}`, background: 'none',
              border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
              fontSize: T.fontSizeSm, color: T.colorTextSecondary, cursor: 'pointer',
              transition: `all ${T.transitionFast}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!slug || !!error}
            style={{
              padding: `${T.spacingSm} ${T.spacingLg}`,
              background: !slug || error ? T.colorBorder : T.colorAccent,
              color: !slug || error ? T.colorTextMuted : T.colorBg,
              border: 'none', borderRadius: T.radiusSm,
              fontSize: T.fontSizeSm, fontWeight: 500,
              cursor: !slug || error ? 'default' : 'pointer',
              transition: `all ${T.transitionFast}`,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreatePostModal;
