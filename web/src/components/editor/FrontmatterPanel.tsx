import { type FC, useState, useEffect, useCallback } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';
import TagChipEditor from './TagChipEditor';
import type { FrontmatterData } from '../../lib/frontmatter-utils';

interface FrontmatterPanelProps {
  data: FrontmatterData;
  onChange: (field: keyof FrontmatterData, value: FrontmatterData[keyof FrontmatterData]) => void;
}

/** Shared styles for field labels */
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: T.fontSizeSm,
  fontFamily: T.fontSans,
  fontWeight: 600,
  color: T.colorTextSecondary,
  marginBottom: T.spacingXs,
};

/** Shared base styles for text inputs and textareas */
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

/** Shared styles for the clear (×) button on optional fields */
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

const FrontmatterPanel: FC<FrontmatterPanelProps> = ({ data, onChange }) => {
  // Internal state so edits are reflected immediately without waiting for
  // the CM6 decoration rebuild cycle (which is intentionally skipped during
  // widget-initiated dispatches to avoid input focus loss).
  const [local, setLocal] = useState<FrontmatterData>(data);

  // Sync from external prop when the document changes (e.g. page switch)
  useEffect(() => {
    setLocal(data);
  }, [data]);

  const handleChange = useCallback(
    (field: keyof FrontmatterData, value: FrontmatterData[keyof FrontmatterData]) => {
      setLocal((prev) => ({ ...prev, [field]: value } as FrontmatterData));
      onChange(field, value);
    },
    [onChange],
  );

  const handleTagAdd = useCallback(
    (tag: string) => {
      const next = [...local.tags, tag];
      setLocal((prev) => ({ ...prev, tags: next }));
      onChange('tags', next);
    },
    [local.tags, onChange],
  );

  const handleTagRemove = useCallback(
    (index: number) => {
      const next = local.tags.filter((_, i) => i !== index);
      setLocal((prev) => ({ ...prev, tags: next }));
      onChange('tags', next);
    },
    [local.tags, onChange],
  );

  return (
    <div style={{
      padding: `${T.spacingLg} ${T.spacingXl}`,
      background: T.colorBgSecondary,
      fontFamily: T.fontSans,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: T.spacingMd,
    }}>
      {/* Title — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={local.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Post title"
          style={inputBaseStyle}
        />
      </div>

      {/* Description — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={local.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Post description"
          rows={3}
          style={{ ...inputBaseStyle, resize: 'vertical' }}
        />
      </div>

      {/* pubDate */}
      <div>
        <label style={labelStyle}>Publish Date</label>
        <input
          type="text"
          value={local.pubDate}
          onChange={(e) => handleChange('pubDate', e.target.value)}
          placeholder="YYYY/MM/DD"
          style={inputBaseStyle}
        />
      </div>

      {/* updatedDate — optional with clear button */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Updated Date</label>
          {local.updatedDate && (
            <button
              onClick={() => handleChange('updatedDate', undefined)}
              aria-label="Clear updated date"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="text"
            value={local.updatedDate ?? ''}
            onChange={(e) => handleChange('updatedDate', e.target.value || undefined)}
            placeholder="YYYY/MM/DD"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* heroImage — optional with clear button */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Hero Image</label>
          {local.heroImage && (
            <button
              onClick={() => handleChange('heroImage', undefined)}
              aria-label="Clear hero image"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="text"
            value={local.heroImage ?? ''}
            onChange={(e) => handleChange('heroImage', e.target.value || undefined)}
            placeholder="Optional — e.g. ./assets/hero.png"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* category — optional with clear button */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Category</label>
          {local.category && (
            <button
              onClick={() => handleChange('category', undefined)}
              aria-label="Clear category"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="text"
            value={local.category ?? ''}
            onChange={(e) => handleChange('category', e.target.value || undefined)}
            placeholder="Optional"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* Tags — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Tags</label>
        <TagChipEditor
          tags={local.tags}
          onAdd={handleTagAdd}
          onRemove={handleTagRemove}
        />
      </div>
    </div>
  );
};

export default FrontmatterPanel;
