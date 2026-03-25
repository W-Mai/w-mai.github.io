import { type FC, useState, useEffect, useCallback, useRef } from 'react';
import { EDITOR_TOKENS as T } from '../shared/editor-tokens';
import TagChipEditor from './TagChipEditor';
import DateTimePicker from './DateTime';
import CategoryPicker from './Category';
import type { FrontmatterData } from '../../../lib/frontmatter-utils';

interface FrontmatterPanelProps {
  slug?: string;
  data: FrontmatterData;
  onChange: (field: keyof FrontmatterData, value: FrontmatterData[keyof FrontmatterData]) => void;
  allCategories?: string[];
  onCategoriesChange?: (categories: string[]) => void;
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

/** Resolve heroImage path to editor preview URL */
function resolveHeroImageUrl(heroImage: string, slug?: string): string {
  if (heroImage.startsWith('./assets/')) {
    return `/api/editor/assets/${encodeURIComponent(heroImage.replace('./assets/', ''))}`;
  }
  // Co-located image (e.g. ./strange-bug.jpg)
  const name = heroImage.replace('./', '');
  if (slug) {
    return `/api/editor/posts/${slug}/images/${encodeURIComponent(name)}`;
  }
  return `/api/editor/assets/${encodeURIComponent(name)}`;
}

const FrontmatterPanel: FC<FrontmatterPanelProps> = ({ slug, data, onChange, allCategories = [], onCategoriesChange }) => {
  const [local, setLocal] = useState<FrontmatterData>(data);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [assets, setAssets] = useState<{ name: string; ext: string }[]>([]);
  const [postImages, setPostImages] = useState<{ name: string; ext: string }[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync from external prop when the document changes (e.g. page switch)
  useEffect(() => {
    setLocal(data);
  }, [data]);

  // Fetch global assets and post co-located images when picker opens
  useEffect(() => {
    if (!showImagePicker) return;
    fetch('/api/editor/assets')
      .then((r) => r.json())
      .then((list: { name: string; ext: string }[]) => {
        setAssets(list.filter((a) => IMAGE_EXTS.has(a.ext)));
      })
      .catch(() => {});
    if (slug) {
      fetch(`/api/editor/posts/${slug}/images`)
        .then((r) => r.json())
        .then((list: { name: string; ext: string }[]) => {
          setPostImages(list.filter((a) => IMAGE_EXTS.has(a.ext)));
        })
        .catch(() => {});
    }
  }, [showImagePicker, slug]);

  // Animate-then-close helper
  const closePicker = useCallback(() => {
    if (!showImagePicker || pickerClosing) return;
    setPickerClosing(true);
    setTimeout(() => {
      setShowImagePicker(false);
      setPickerClosing(false);
    }, 200);
  }, [showImagePicker, pickerClosing]);

  // Close picker on outside click
  useEffect(() => {
    if (!showImagePicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImagePicker, closePicker]);

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
      padding: `${T.spacingLg} ${T.spacingLg} ${T.spacing3xl}`,
      fontFamily: T.fontSans,
    }}>
    <div style={{
      padding: `${T.spacingXl} ${T.spacing2xl}`,
      background: T.colorBg,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: T.spacingMd,
      borderRadius: T.radiusLg,
      boxShadow: T.shadowRaised,
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
        <DateTimePicker
          value={local.pubDate}
          onChange={(v) => handleChange('pubDate', v)}
          placeholder="YYYY/MM/DD HH:mm"
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
          <DateTimePicker
            value={local.updatedDate ?? ''}
            onChange={(v) => handleChange('updatedDate', v || undefined)}
            placeholder="YYYY/MM/DD HH:mm"
          />
        </div>
      </div>

      {/* heroImage — visual picker */}
      <div style={{ position: 'relative' }} ref={pickerRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Hero Image</label>
          {local.heroImage && (
            <button
              onClick={() => { handleChange('heroImage', undefined); closePicker(); }}
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
                  src={resolveHeroImageUrl(local.heroImage, slug)}
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

          {/* Image picker dropdown — neumorphism style */}
          {(showImagePicker || pickerClosing) && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 100,
              marginTop: T.spacingSm,
              background: T.colorBg,
              border: 'none',
              borderRadius: T.radiusLg,
              boxShadow: T.shadowRaised,
              maxHeight: '280px',
              overflow: 'auto',
              padding: T.spacingMd,
              animation: pickerClosing
                ? 'heroPickerOut 0.2s ease both'
                : 'heroPickerIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}>
              <style>{`
                @keyframes heroPickerOut {
                  from { opacity: 1; transform: scale(1) translateY(0); }
                  to { opacity: 0; transform: scale(0.92) translateY(-4px); }
                }
                @keyframes heroPickerIn {
                  from { opacity: 0; transform: scale(0.92) translateY(-4px); }
                  to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes heroThumbIn {
                  from { opacity: 0; transform: scale(0.85); }
                  to { opacity: 1; transform: scale(1); }
                }
                .hero-thumb {
                  transition: all 150ms ease;
                }
                .hero-thumb:hover {
                  transform: translateY(-2px);
                  box-shadow: ${T.shadowBtnHover};
                }
                .hero-thumb:active {
                  transform: translateY(0);
                  box-shadow: ${T.shadowInset};
                }
              `}</style>
              {postImages.length === 0 && assets.length === 0 ? (
                <div style={{
                  padding: T.spacingLg, color: T.colorTextMuted,
                  fontSize: T.fontSizeSm, textAlign: 'center',
                  borderRadius: T.radiusSm,
                  boxShadow: T.shadowInset,
                }}>
                  No images found
                </div>
              ) : (
                <>
                  {/* Post co-located images */}
                  {postImages.length > 0 && (
                    <>
                      <div style={{
                        fontSize: T.fontSizeXs, color: T.colorTextMuted,
                        padding: `${T.spacingXs} ${T.spacingSm}`,
                        fontWeight: 600, letterSpacing: '0.02em',
                      }}>
                        📁 Post Images
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                        gap: T.spacingSm,
                        padding: T.spacingSm,
                        marginBottom: assets.length > 0 ? T.spacingSm : 0,
                        borderRadius: T.radiusSm,
                        boxShadow: T.shadowInset,
                      }}>
                        {postImages.map((a, idx) => {
                          const ref = `./${a.name}`;
                          const isSelected = local.heroImage === ref;
                          return (
                            <button
                              className={isSelected ? '' : 'hero-thumb'}
                              key={`post-${a.name}`}
                              type="button"
                              onClick={() => {
                                handleChange('heroImage', ref);
                                closePicker();
                              }}
                              title={a.name}
                              style={{
                                padding: '3px',
                                border: 'none',
                                borderRadius: T.radiusSm,
                                background: isSelected
                                  ? 'linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light))'
                                  : T.colorBg,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                aspectRatio: '1',
                                boxShadow: isSelected ? T.shadowInset : T.shadowBtn,
                                animation: `heroThumbIn 0.2s ease both`,
                                animationDelay: `${Math.min(idx * 30, 300)}ms`,
                              }}
                            >
                              <img
                                src={`/api/editor/posts/${slug}/images/${encodeURIComponent(a.name)}`}
                                alt={a.name}
                                loading="lazy"
                                style={{
                                  width: '100%', height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  display: 'block',
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {/* Global assets */}
                  {assets.length > 0 && (
                    <>
                      <div style={{
                        fontSize: T.fontSizeXs, color: T.colorTextMuted,
                        padding: `${T.spacingXs} ${T.spacingSm}`,
                        fontWeight: 600, letterSpacing: '0.02em',
                      }}>
                        🌐 Global Assets
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                        gap: T.spacingSm,
                        padding: T.spacingSm,
                        borderRadius: T.radiusSm,
                        boxShadow: T.shadowInset,
                      }}>
                        {assets.map((a, idx) => {
                          const ref = `./assets/${a.name}`;
                          const isSelected = local.heroImage === ref;
                          const delay = postImages.length * 30 + idx * 30;
                          return (
                            <button
                              className={isSelected ? '' : 'hero-thumb'}
                              key={`global-${a.name}`}
                              type="button"
                              onClick={() => {
                                handleChange('heroImage', ref);
                                closePicker();
                              }}
                              title={a.name}
                              style={{
                                padding: '3px',
                                border: 'none',
                                borderRadius: T.radiusSm,
                                background: isSelected
                                  ? 'linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light))'
                                  : T.colorBg,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                aspectRatio: '1',
                                boxShadow: isSelected ? T.shadowInset : T.shadowBtn,
                                animation: `heroThumbIn 0.2s ease both`,
                                animationDelay: `${Math.min(delay, 600)}ms`,
                              }}
                            >
                              <img
                                src={`/api/editor/assets/${encodeURIComponent(a.name)}`}
                                alt={a.name}
                                loading="lazy"
                                style={{
                                  width: '100%', height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  display: 'block',
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* category — dropdown with add/remove */}
      <CategoryPicker
        value={local.category}
        categories={allCategories}
        onChange={(v) => handleChange('category', v)}
        onCategoriesChange={onCategoriesChange ?? (() => {})}
      />

      {/* Tags — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Tags</label>
        <TagChipEditor
          tags={local.tags}
          onAdd={handleTagAdd}
          onRemove={handleTagRemove}
        />
      </div>

      {/* series — optional with clear button */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Series (slug)</label>
          {local.series && (
            <button
              onClick={() => handleChange('series', undefined)}
              aria-label="Clear series"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="text"
            value={local.series ?? ''}
            onChange={(e) => handleChange('series', e.target.value || undefined)}
            placeholder="e.g. rust-notes"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* seriesOrder — optional numeric */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Series Order</label>
          {local.seriesOrder !== undefined && (
            <button
              onClick={() => handleChange('seriesOrder', undefined)}
              aria-label="Clear series order"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="number"
            min={0}
            value={local.seriesOrder ?? ''}
            onChange={(e) => handleChange('seriesOrder', e.target.value === '' ? undefined : Number(e.target.value))}
            placeholder="0, 1, 2…"
            style={inputBaseStyle}
          />
        </div>
      </div>

      {/* seriesTitle — optional, full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Series Title</label>
          {local.seriesTitle && (
            <button
              onClick={() => handleChange('seriesTitle', undefined)}
              aria-label="Clear series title"
              style={clearBtnStyle}
            >×</button>
          )}
        </div>
        <div style={{ marginTop: T.spacingXs }}>
          <input
            type="text"
            value={local.seriesTitle ?? ''}
            onChange={(e) => handleChange('seriesTitle', e.target.value || undefined)}
            placeholder="Display name (optional)"
            style={inputBaseStyle}
          />
        </div>
      </div>
    </div>
    </div>
  );
};

export default FrontmatterPanel;
