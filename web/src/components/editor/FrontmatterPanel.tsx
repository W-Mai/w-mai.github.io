import { type FC, useCallback } from 'react';
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
  const handleTagAdd = useCallback(
    (tag: string) => onChange('tags', [...data.tags, tag]),
    [data.tags, onChange],
  );

  const handleTagRemove = useCallback(
    (index: number) => onChange('tags', data.tags.filter((_, i) => i !== index)),
    [data.tags, onChange],
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
          value={data.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="Post title"
          style={inputBaseStyle}
        />
      </div>

      {/* Description — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Post description"
          rows={3}
          style={{ ...inputBaseStyle, resize: 'vertical' }}
        />
      </div>

      {/* pubDate */}
      <div>
        <label style={labelStyle}>Publish Date</label>
        <input
          type="date"
          value={data.pubDate}
          onChange={(e) => onChange('pubDate', e.target.value)}
          style={inputBaseStyle}
        />
      </div>

      {/* updatedDate — optional with clear button */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Updated Date</label>
          {data.updatedDate && (
            <button
              onClick={() => onChange('updatedDate', undefined)}
              aria-label="Clear updated date"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="date"
            value={data.updatedDate ?? ''}
            onChange={(e) => onChange('updatedDate', e.target.value || undefined)}
            placeholder="Optional"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* heroImage — optional with clear button */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Hero Image</label>
          {data.heroImage && (
            <button
              onClick={() => onChange('heroImage', undefined)}
              aria-label="Clear hero image"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="text"
            value={data.heroImage ?? ''}
            onChange={(e) => onChange('heroImage', e.target.value || undefined)}
            placeholder="Optional — e.g. ./assets/hero.png"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* category — optional with clear button */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Category</label>
          {data.category && (
            <button
              onClick={() => onChange('category', undefined)}
              aria-label="Clear category"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="text"
            value={data.category ?? ''}
            onChange={(e) => onChange('category', e.target.value || undefined)}
            placeholder="Optional"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* Tags — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Tags</label>
        <TagChipEditor
          tags={data.tags}
          onAdd={handleTagAdd}
          onRemove={handleTagRemove}
        />
      </div>
    </div>
  );
};

export default FrontmatterPanel;
