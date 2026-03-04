import { useState, useEffect, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';
import { validatePostSlug } from '../../lib/editor-utils';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface CreatePostModalProps {
  isOpen: boolean;
  existingSlugs: string[];
  onConfirm: (slug: string) => void;
  onCancel: () => void;
}

const CreatePostModal: FC<CreatePostModalProps> = ({ isOpen, existingSlugs, onConfirm, onCancel }) => {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSlug('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const validate = (value: string): string | null => {
    if (!value) return null;
    const result = validatePostSlug(value);
    if (!result.valid) return result.error || 'Invalid slug';
    if (existingSlugs.includes(value)) return 'This slug already exists';
    return null;
  };

  const handleChange = (value: string) => {
    setSlug(value);
    setError(validate(value));
  };

  const handleSubmit = () => {
    const err = validate(slug);
    if (err || !slug) { setError(err || 'Slug is required'); return; }
    onConfirm(slug);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !error && slug) handleSubmit();
    if (e.key === 'Escape') onCancel();
  };

  if (!isOpen) return null;

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
        padding: T.spacingXl, width: '360px',
        fontFamily: T.fontSans,
      }}>
        <div style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText, marginBottom: T.spacingLg }}>
          New Post
        </div>

        <input
          ref={inputRef}
          type="text"
          value={slug}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="my-new-post"
          style={{
            width: '100%', padding: `${T.spacingSm} ${T.spacingMd}`,
            border: `1px solid ${error ? T.colorError : T.colorBorder}`,
            borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
            fontFamily: T.fontMono, outline: 'none',
            boxSizing: 'border-box',
            transition: `border-color ${T.transitionFast}`,
          }}
        />

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
              fontSize: T.fontSizeSm, fontWeight: 500, cursor: !slug || error ? 'default' : 'pointer',
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
