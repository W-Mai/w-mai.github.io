/**
 * TagInput — visual tag selector for the thought editor.
 * Shows selected tags as chips, with a portal dropdown (2D grid) to pick existing tags or add new ones.
 * New tags (not in allTags) are visually distinct.
 */

import { useState, useRef, useEffect, useCallback, type FC } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Detect multi-line wrapping
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

  // Update dropdown position when opening
  useEffect(() => {
    if (!open || !innerRef.current) { if (!open) setDropdownPos(null); return; }
    const rect = innerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 280),
    });
  }, [open]);

  const [closing, setClosing] = useState(false);

  const closeDropdown = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 180);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeDropdown]);

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
      closeDropdown();
    }
  }, [inputValue, tags, addTag, removeTag, closeDropdown]);

  const suggestions = allTags.filter(t =>
    !tags.includes(t) && t.toLowerCase().includes(inputValue.toLowerCase())
  );
  const isNew = !!(inputValue.trim() && !allTags.includes(inputValue.trim()) && !tags.includes(inputValue.trim()));

  const dropdown = (open || closing) && (suggestions.length > 0 || isNew) && dropdownPos && typeof document !== 'undefined'
    ? createPortal(
        <div style={{
          position: 'absolute',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          background: T.colorBg,
          borderRadius: '1.5rem',
          boxShadow: '6px 6px 12px var(--neu-shadow-dark), -6px -6px 12px var(--neu-shadow-light)',
          zIndex: 9999,
          padding: '0.5rem',
          transformOrigin: 'top left',
          animation: closing
            ? 'tag-dropdown-out 180ms ease forwards'
            : 'tag-dropdown-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <style>{`
            @keyframes tag-dropdown-in {
              from { opacity: 0; transform: scale(0.88) translateY(-6px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes tag-dropdown-out {
              from { opacity: 1; transform: scale(1) translateY(0); }
              to   { opacity: 0; transform: scale(0.92) translateY(-4px); }
            }
          `}</style>
          {/* New tag option */}
          {isNew && (
            <div style={{ marginBottom: suggestions.length > 0 ? '0.4rem' : 0, paddingBottom: suggestions.length > 0 ? '0.4rem' : 0, borderBottom: suggestions.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
              <button
                onMouseDown={(e) => { e.preventDefault(); addTag(inputValue); closeDropdown(); }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #a78bfa33, #818cf833)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = ''; }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', borderRadius: '9999px', fontSize: T.fontSizeXs,
                  color: '#7c3aed', fontFamily: T.fontSans,
                  transition: 'background 150ms ease, transform 150ms ease',
                }}
              >
                <span style={{ fontSize: '0.6rem' }}>✦</span>
                新增 "{inputValue.trim()}"
              </button>
            </div>
          )}
          {/* Existing tags — 2D flex grid */}
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '2px' }}>
              {suggestions.slice(0, 30).map(tag => (
                <button
                  key={tag}
                  onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(145deg, var(--neu-gradient-light), var(--neu-gradient-dark))'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = ''; }}
                  style={{
                    padding: '4px 12px', background: 'transparent',
                    border: 'none', cursor: 'pointer', borderRadius: '9999px',
                    fontSize: T.fontSizeXs, color: 'var(--text-secondary)',
                    fontFamily: T.fontSans,
                    transition: 'background 150ms ease, transform 150ms ease',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
      <div
        ref={innerRef}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center',
          padding: (isMobile || isMultiLine) ? '0.4rem 0.75rem' : '0.25rem 0.5rem',
          borderRadius: '1.5rem',
          background: T.colorBg,
          boxShadow: 'inset 2px 2px 4px var(--neu-shadow-dark-strong), inset -2px -2px 4px var(--neu-shadow-light-strong)',
          cursor: 'text',
          minHeight: '2.2rem',
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
                el.style.background = isNewTag ? 'linear-gradient(135deg, #a78bfa44, #818cf844)' : 'linear-gradient(145deg, var(--neu-gradient-light), var(--neu-gradient-dark))';
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
                padding: '2px 8px', borderRadius: '9999px',
                fontSize: T.fontSizeXs, fontWeight: 500,
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', lineHeight: 1, fontSize: '0.7rem', color: 'inherit', opacity: 0.6 }}
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
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: T.fontSizeXs, color: T.colorText, fontFamily: T.fontSans, flex: 1, minWidth: '60px', padding: '2px 0' }}
        />
      </div>
      {dropdown}
    </div>
  );
};

export default TagInput;
