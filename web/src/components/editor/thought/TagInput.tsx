/**
 * TagInput — visual tag selector for the thought editor.
 * Shows selected tags as chips, with a dropdown to pick existing tags or add new ones.
 * New tags (not in allTags) are visually distinct.
 */

import { useState, useRef, useEffect, useCallback, type FC } from 'react';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';

interface TagInputProps {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
}

const TagInput: FC<TagInputProps> = ({ tags, allTags, onChange }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [isMultiLine, setIsMultiLine] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Detect multi-line wrapping by comparing first and last chip offsetTop
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const check = () => {
      const chips = el.querySelectorAll<HTMLElement>('[data-chip]');
      if (chips.length < 2) { setIsMultiLine(false); return; }
      setIsMultiLine(chips[0].offsetTop !== chips[chips.length - 1].offsetTop);
    };
    const obs = new ResizeObserver(check);
    obs.observe(el);
    check();
    return () => obs.disconnect();
  }, [tags]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter(t => t !== tag));
  }, [tags, onChange]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInputValue('');
  }, [tags, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [inputValue, tags, addTag, removeTag]);

  // Filter suggestions: existing tags not yet selected, matching input
  const suggestions = allTags.filter(t =>
    !tags.includes(t) && t.toLowerCase().includes(inputValue.toLowerCase())
  );

  // New tag: typed value not in allTags
  const isNew = inputValue.trim() && !allTags.includes(inputValue.trim()) && !tags.includes(inputValue.trim());

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
      {/* Tag chips + input */}
      <div
        ref={innerRef}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center',
          padding: (isMobile || isMultiLine) ? '0.5rem 0.75rem' : '0.2rem 0.5rem',
          borderRadius: '1.5rem',
          background: T.colorBg,
          boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark-strong), inset -2px -2px 4px var(--neu-shadow-light-strong)',
          cursor: 'text',
          minHeight: '2.7rem',
        }}
      >
        {tags.map(tag => {
          const isNewTag = !allTags.includes(tag);
          return (
            <span
              key={tag}
              data-chip
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLSpanElement;
                el.style.background = isNewTag
                  ? 'linear-gradient(135deg, #a78bfa44, #818cf844)'
                  : 'linear-gradient(145deg, var(--neu-gradient-light), var(--neu-gradient-dark))';
                el.style.boxShadow = isNewTag ? '0 0 0 1px #a78bfa66' : 'none';
                el.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLSpanElement;
                el.style.background = isNewTag ? 'linear-gradient(135deg, #a78bfa22, #818cf822)' : 'transparent';
                el.style.boxShadow = isNewTag ? '0 0 0 1px #a78bfa44' : 'none';
                el.style.transform = '';
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: T.fontSizeXs,
                fontWeight: 500,
                background: isNewTag ? 'linear-gradient(135deg, #a78bfa22, #818cf822)' : 'transparent',
                color: isNewTag ? '#7c3aed' : 'var(--text-secondary)',
                boxShadow: isNewTag ? '0 0 0 1px #a78bfa44' : 'none',
                transition: 'transform 150ms ease, background 150ms ease, box-shadow 150ms ease',
                cursor: 'default',
              }}
            >
              {isNewTag && <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>✦</span>}
              {tag}
              <button
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 1px', lineHeight: 1, fontSize: '0.7rem',
                  color: 'inherit', opacity: 0.6,
                }}
              >×</button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: T.fontSizeXs, color: T.colorText,
            fontFamily: T.fontSans, flex: 1, minWidth: '60px',
            padding: '2px 0',
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (suggestions.length > 0 || isNew) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: T.colorBg,
          borderRadius: T.radiusMd,
          boxShadow: '6px 6px 12px var(--neu-shadow-dark), -6px -6px 12px var(--neu-shadow-light)',
          zIndex: 50,
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '4px',
        }}>
          {/* New tag option */}
          {isNew && (
            <button
              onMouseDown={(e) => { e.preventDefault(); addTag(inputValue); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '6px 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderRadius: '8px', fontSize: T.fontSizeXs,
                color: '#7c3aed', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#a78bfa22')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: '0.6rem' }}>✦</span>
              新增 "{inputValue.trim()}"
            </button>
          )}
          {/* Existing tags */}
          {suggestions.slice(0, 20).map(tag => (
            <button
              key={tag}
              onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
              style={{
                display: 'block', width: '100%', padding: '6px 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderRadius: '8px', fontSize: T.fontSizeXs,
                color: 'var(--text-secondary)', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(145deg, var(--neu-gradient-light), var(--neu-gradient-dark))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
