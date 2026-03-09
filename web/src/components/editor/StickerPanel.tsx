import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface StickerInfo {
  name: string;
  size: number;
}

interface StickerPanelProps {
  onInsertInline?: (syntax: string) => void;
  onInsertBlock?: (syntax: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const StickerPanel: FC<StickerPanelProps> = ({ onInsertInline, onInsertBlock }) => {
  const [stickers, setStickers] = useState<StickerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewSticker, setPreviewSticker] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStickers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/editor/stickers');
      const data: StickerInfo[] = await res.json();
      setStickers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStickers(); }, [fetchStickers]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
        const res = await fetch(`/api/editor/stickers/${encodeURIComponent(name)}`, {
          method: 'PUT', body: file,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to upload ${name}`);
        }
      }
      await fetchStickers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [fetchStickers]);

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(`Delete sticker "${name}"?`)) return;
    try {
      await fetch(`/api/editor/stickers/${encodeURIComponent(name)}`, { method: 'DELETE' });
      await fetchStickers();
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchStickers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Preview lightbox */}
      {previewSticker && (
        <div
          onClick={() => setPreviewSticker(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
          }}
        >
          <img
            src={`/api/editor/stickers/${encodeURIComponent(previewSticker)}`}
            alt={previewSticker}
            style={{
              maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain',
              borderRadius: T.radiusMd, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      )}

      {/* Upload area */}
      <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} style={{
        padding: T.spacingMd, borderBottom: `1px solid ${T.colorBorder}`,
      }}>
        <input ref={fileInputRef} type="file" multiple accept=".png,.gif,.apng,.webp,.jpg,.jpeg,.svg"
          onChange={(e) => handleUpload(e.target.files)} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
          width: '100%', padding: '0.4rem',
          background: T.colorBgTertiary, border: `1px dashed #d1d5db`,
          borderRadius: T.radiusMd, cursor: 'pointer',
          fontSize: T.fontSizeSm, color: T.colorTextSecondary,
          transition: `all ${T.transitionFast}`,
        }}>
          {uploading ? 'Uploading...' : '😀 Upload stickers'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: `${T.spacingSm} ${T.spacingMd}`, background: T.colorErrorBg,
          color: T.colorError, fontSize: T.fontSizeXs,
          borderBottom: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: T.spacingXs,
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{
            background: 'none', border: 'none', color: T.colorError, cursor: 'pointer', fontSize: T.fontSizeMd,
          }}>×</button>
        </div>
      )}

      {/* Sticker grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: T.spacingSm }}>
        {isLoading && stickers.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeMd, textAlign: 'center' }}>Loading...</div>
        ) : stickers.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeSm, textAlign: 'center' }}>
            No stickers yet. Upload some!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: T.spacingSm }}>
            {stickers.map((s) => (
              <div key={s.name} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: T.spacingSm, borderRadius: T.radiusMd,
                background: T.colorBgSecondary, position: 'relative',
                transition: `all ${T.transitionFast}`,
              }}>
                <img
                  src={`/api/editor/stickers/${encodeURIComponent(s.name)}`}
                  alt={s.name}
                  onClick={() => setPreviewSticker(s.name)}
                  style={{
                    width: '48px', height: '48px', objectFit: 'contain',
                    cursor: 'zoom-in', borderRadius: T.radiusSm,
                  }}
                />
                <div style={{
                  fontSize: '0.55rem', color: T.colorTextMuted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  width: '100%', textAlign: 'center', marginTop: '2px',
                  maxWidth: '60px',
                }} title={s.name}>
                  {s.name.replace(/\.[^.]+$/, '')}
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                  <button
                    onClick={() => onInsertInline?.(`:sticker[${s.name}]:`)}
                    title="Insert inline"
                    style={{
                      background: 'none', border: `1px solid ${T.colorBorder}`,
                      borderRadius: '3px', cursor: 'pointer', padding: '1px 4px',
                      fontSize: '0.5rem', color: T.colorTextSecondary,
                    }}
                  >行内</button>
                  <button
                    onClick={() => onInsertBlock?.(`::sticker[${s.name}]::`)}
                    title="Insert block"
                    style={{
                      background: 'none', border: `1px solid ${T.colorBorder}`,
                      borderRadius: '3px', cursor: 'pointer', padding: '1px 4px',
                      fontSize: '0.5rem', color: T.colorTextSecondary,
                    }}
                  >行间</button>
                  <button
                    onClick={() => handleDelete(s.name)}
                    title="Delete"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '1px 3px', fontSize: '0.55rem', color: '#d1d5db',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.colorError; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerPanel;
