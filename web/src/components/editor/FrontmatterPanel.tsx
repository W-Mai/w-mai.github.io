import { type FC, useState, useEffect, useCallback, useRef } from 'react';
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

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif']);

const FrontmatterPanel: FC<FrontmatterPanelProps> = ({ data, onChange }) => {
  const [local, setLocal] = useState<FrontmatterData>(data);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [assets, setAssets] = useState<{ name: string; ext: string }[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync from external prop when the document changes (e.g. page switch)
  useEffect(() => {
    setLocal(data);
  }, [data]);

  // Fetch image assets when picker opens
  useEffect(() => {
    if (!showImagePicker) return;
    fetch('/api/editor/assets')
      .then((r) => r.json())
      .then((list: { name: string; ext: string }[]) => {
        setAssets(list.filter((a) => IMAGE_EXTS.has(a.ext)));
      })
      .catch(() => {});
  }, [showImagePicker]);

  // Close picker on outside click
  useEffect(() => {
    if (!showImagePicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowImagePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImagePicker]);

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

      {/* heroImage — visual picker */}
      <div style={{ position: 'relative' }} ref={pickerRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Hero Image</label>
          {local.heroImage && (
            <button
              onClick={() => { handleChange('heroImage', undefined); setShowImagePicker(false); }}
              aria-label="Clear hero image"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <button
            type="button"
            onClick={() => setShowImagePicker((v) => !v)}
            style={{
              ...inputBaseStyle,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: T.spacingSm,
              textAlign: 'left',
              color: local.heroImage ? T.colorText : T.colorTextMuted,
            }}
          >
            {local.heroImage ? (
              <>
                <img
                  src={`/api/editor/assets/${encodeURIComponent(local.heroImage.replace('./assets/', ''))}`}
                  alt=""
                  style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {local.heroImage.replace('./assets/', '')}
                </span>
              </>
            ) : (
              <span>Select image…</span>
            )}
          </button>

          {/* Image picker dropdown */}
          {showImagePicker && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 100,
              marginTop: '4px',
              background: T.colorBg,
              border: `1px solid ${T.colorBorder}`,
              borderRadius: T.radiusMd,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: '240px',
              overflow: 'auto',
              padding: T.spacingSm,
            }}>
              {assets.length === 0 ? (
                <div style={{ padding: T.spacingMd, color: T.colorTextMuted, fontSize: T.fontSizeSm, textAlign: 'center' }}>
                  No images found
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                  gap: '6px',
                }}>
                  {assets.map((a) => {
                    const isSelected = local.heroImage === `./assets/${a.name}`;
                    return (
                      <button
                        key={a.name}
                        type="button"
                        onClick={() => {
                          handleChange('heroImage', `./assets/${a.name}`);
                          setShowImagePicker(false);
                        }}
                        title={a.name}
                        style={{
                          padding: '3px',
                          border: isSelected ? `2px solid ${T.colorAccent}` : `1px solid ${T.colorBorderLight}`,
                          borderRadius: T.radiusSm,
                          background: isSelected ? T.colorBgSecondary : 'transparent',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          aspectRatio: '1',
                        }}
                      >
                        <img
                          src={`/api/editor/assets/${encodeURIComponent(a.name)}`}
                          alt={a.name}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '2px',
                            display: 'block',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
