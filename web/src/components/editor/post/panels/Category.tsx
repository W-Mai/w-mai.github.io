import { type FC, useState, useRef, useEffect, useCallback } from 'react';
import { EDITOR_TOKENS as T } from '../shared/editor-tokens';

interface CategoryPickerProps {
  value?: string;
  categories: string[];
  onChange: (value: string | undefined) => void;
  onCategoriesChange: (categories: string[]) => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: T.fontSizeSm,
  fontFamily: T.fontSans,
  fontWeight: 600,
  color: T.colorTextSecondary,
  marginBottom: T.spacingXs,
};

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: `${T.spacingXs} ${T.spacingSm}`,
  background: T.colorBg,
  border: `1px solid ${T.colorBorderLight}`,
  borderRadius: T.radiusSm,
  fontSize: T.fontSizeSm,
  fontFamily: T.fontSans,
  color: T.colorText,
  boxShadow: T.shadowInset,
  outline: 'none',
  transition: `border-color ${T.transitionFast}`,
};

const clearBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0 4px',
  fontSize: T.fontSizeMd,
  color: T.colorTextMuted,
  lineHeight: 1,
  transition: `color ${T.transitionFast}`,
};

const CategoryPicker: FC<CategoryPickerProps> = ({
  value, categories, onChange, onCategoriesChange,
}) => {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [newCat, setNewCat] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  }, [open, closing]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeDropdown]);

  const handleSelect = (cat: string) => {
    onChange(cat);
    closeDropdown();
  };

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const next = [...categories, trimmed];
    onCategoriesChange(next);
    onChange(trimmed);
    setNewCat('');
    closeDropdown();
  };

  const handleDelete = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = categories.filter((c) => c !== cat);
    onCategoriesChange(next);
    if (value === cat) onChange(undefined);
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Category</label>
        {value && (
          <button
            onClick={() => onChange(undefined)}
            aria-label="Clear category"
            style={clearBtnStyle}
          >×</button>
        )}
      </div>
      <div style={{ marginTop: T.spacingXs }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            ...inputBaseStyle,
            cursor: 'pointer',
            textAlign: 'left',
            color: value ? T.colorText : T.colorTextMuted,
          }}
        >
          {value || '— Select —'}
        </button>

        {/* Dropdown panel */}
        {(open || closing) && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            marginTop: T.spacingSm,
            background: T.colorBg,
            borderRadius: T.radiusLg,
            boxShadow: T.shadowRaised,
            padding: T.spacingSm,
            animation: closing
              ? 'catPickerOut 0.2s ease both'
              : 'catPickerIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}>
            <style>{`
              @keyframes catPickerIn {
                from { opacity: 0; transform: scale(0.92) translateY(-4px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
              @keyframes catPickerOut {
                from { opacity: 1; transform: scale(1) translateY(0); }
                to { opacity: 0; transform: scale(0.92) translateY(-4px); }
              }
              .cat-pick-item {
                transition: all 150ms ease;
              }
              .cat-pick-item:hover {
                background: linear-gradient(145deg, var(--neu-gradient-light), var(--neu-gradient-dark));
                transform: translateY(-1px);
              }
              .cat-pick-item:active {
                background: linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light));
                box-shadow: ${T.shadowInset};
                transform: translateY(0);
              }
              .cat-del-btn {
                opacity: 0;
                transition: opacity 150ms ease, color 150ms ease;
              }
              .cat-pick-item:hover .cat-del-btn {
                opacity: 1;
              }
            `}</style>

            {/* Existing categories */}
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className="cat-pick-item"
                onClick={() => handleSelect(cat)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: `${T.spacingXs} ${T.spacingSm}`,
                  border: 'none',
                  borderRadius: T.radiusSm,
                  background: value === cat
                    ? 'linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light))'
                    : 'transparent',
                  boxShadow: value === cat ? T.shadowInset : 'none',
                  cursor: 'pointer',
                  fontSize: T.fontSizeSm,
                  fontFamily: T.fontSans,
                  color: T.colorText,
                  textAlign: 'left',
                }}
              >
                <span>{cat}</span>
                <span
                  className="cat-del-btn"
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete category ${cat}`}
                  onClick={(e) => handleDelete(cat, e)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(cat, e as any); }}
                  style={{
                    fontSize: T.fontSizeXs,
                    color: T.colorTextMuted,
                    padding: '0 4px',
                    cursor: 'pointer',
                  }}
                >✕</span>
              </button>
            ))}

            {/* Add new category */}
            <div style={{
              display: 'flex',
              gap: T.spacingXs,
              marginTop: T.spacingSm,
              borderTop: `1px solid ${T.colorBorderLight}`,
              paddingTop: T.spacingSm,
            }}>
              <input
                type="text"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                placeholder="New category…"
                style={{ ...inputBaseStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newCat.trim() || categories.includes(newCat.trim())}
                style={{
                  padding: `${T.spacingXs} ${T.spacingSm}`,
                  border: 'none',
                  borderRadius: T.radiusSm,
                  background: T.colorBg,
                  boxShadow: T.shadowBtn,
                  cursor: 'pointer',
                  fontSize: T.fontSizeSm,
                  fontFamily: T.fontSans,
                  color: T.colorText,
                  transition: `all ${T.transitionFast}`,
                  opacity: (!newCat.trim() || categories.includes(newCat.trim())) ? 0.4 : 1,
                }}
              >+</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPicker;
