import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface StickerInfo {
  name: string;
  size: number;
}

interface StickerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertInline?: (syntax: string) => void;
  onInsertBlock?: (syntax: string) => void;
}

const StickerPanel: FC<StickerPanelProps> = ({ isOpen, onClose, onInsertInline, onInsertBlock }) => {
  const [stickers, setStickers] = useState<StickerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewSticker, setPreviewSticker] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);

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

  useEffect(() => {
    if (isOpen) {
      fetchStickers();
      setPanelPos(null); // Reset position on reopen
    }
  }, [isOpen, fetchStickers]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    e.preventDefault();
    isDragging.current = true;
    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !dragOffset) return;
      setPanelPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const handleMouseUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, dragOffset]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKey);
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

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

  const filtered = filter
    ? stickers.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()))
    : stickers;

  if (!isOpen) return null;

  return (
    <>
      {/* Preview lightbox */}
      {previewSticker && (
        <div
          onClick={() => setPreviewSticker(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
          }}
        >
          <img
            src={`/api/editor/stickers/${encodeURIComponent(previewSticker)}`}
            alt={previewSticker}
            style={{ maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: T.radiusMd }}
          />
        </div>
      )}

      {/* Floating panel */}
      <div ref={panelRef} style={{
        position: 'fixed',
        ...(panelPos
          ? { top: panelPos.y, left: panelPos.x, transform: 'none' }
          : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
        width: '520px', maxWidth: '90vw', maxHeight: '70vh',
        background: T.colorBg, borderRadius: T.radiusLg,
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
        zIndex: 2000, fontFamily: T.fontSans,
      }}>
        {/* Header (draggable) */}
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${T.spacingMd} ${T.spacingLg}`,
            borderBottom: `1px solid ${T.colorBorder}`,
            cursor: 'grab', userSelect: 'none',
          }}>
          <span style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText }}>😀 Stickers</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: T.fontSizeBase, color: T.colorTextMuted, padding: '2px 6px',
          }}>✕</button>
        </div>

        {/* Search + Upload */}
        <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} style={{
          display: 'flex', gap: T.spacingSm,
          padding: `${T.spacingSm} ${T.spacingLg}`,
          borderBottom: `1px solid ${T.colorBorderLight}`,
        }}>
          <input
            type="text" placeholder="Search..."
            value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1, padding: `4px ${T.spacingSm}`,
              border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
              fontSize: T.fontSizeSm, background: T.colorBgSecondary,
              color: T.colorText, outline: 'none',
            }}
          />
          <input ref={fileInputRef} type="file" multiple accept=".png,.gif,.apng,.webp,.jpg,.jpeg,.svg"
            onChange={(e) => handleUpload(e.target.files)} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
            padding: `4px ${T.spacingMd}`,
            background: T.colorBgTertiary, border: `1px solid ${T.colorBorder}`,
            borderRadius: T.radiusSm, cursor: 'pointer',
            fontSize: T.fontSizeSm, color: T.colorTextSecondary,
          }}>
            {uploading ? '...' : '📁 Upload'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: `${T.spacingSm} ${T.spacingLg}`, background: T.colorErrorBg,
            color: T.colorError, fontSize: T.fontSizeXs,
            display: 'flex', alignItems: 'center', gap: T.spacingXs,
          }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{
              background: 'none', border: 'none', color: T.colorError, cursor: 'pointer',
            }}>×</button>
          </div>
        )}

        {/* Sticker grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: T.spacingMd }}>
          {isLoading && stickers.length === 0 ? (
            <div style={{ padding: T.spacingXl, color: T.colorTextMuted, textAlign: 'center' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeSm, textAlign: 'center' }}>
              {stickers.length === 0 ? 'No stickers yet. Upload some!' : 'No matches'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: T.spacingSm }}>
              {filtered.map((s) => (
                <div key={s.name} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '4px', borderRadius: T.radiusSm,
                  background: T.colorBgSecondary, position: 'relative',
                  transition: `all ${T.transitionFast}`,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.colorBgTertiary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = T.colorBgSecondary; }}
                >
                  <img
                    src={`/api/editor/stickers/${encodeURIComponent(s.name)}`}
                    alt={s.name}
                    onClick={() => setPreviewSticker(s.name)}
                    style={{ width: '48px', height: '48px', objectFit: 'contain', cursor: 'zoom-in' }}
                  />
                  <div style={{
                    fontSize: '0.5rem', color: T.colorTextMuted,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    width: '100%', textAlign: 'center', marginTop: '2px', maxWidth: '68px',
                  }} title={s.name}>
                    {s.name.replace(/\.[^.]+$/, '')}
                  </div>
                  <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                    <button
                      onClick={() => { onInsertInline?.(`:sticker[${s.name}]:`); onClose(); }}
                      title="Insert inline" style={{
                        background: 'none', border: `1px solid ${T.colorBorder}`,
                        borderRadius: '3px', cursor: 'pointer', padding: '1px 4px',
                        fontSize: '0.5rem', color: T.colorTextSecondary,
                      }}
                    >行内</button>
                    <button
                      onClick={() => { onInsertBlock?.(`\n::sticker[${s.name}]::\n`); onClose(); }}
                      title="Insert block" style={{
                        background: 'none', border: `1px solid ${T.colorBorder}`,
                        borderRadius: '3px', cursor: 'pointer', padding: '1px 4px',
                        fontSize: '0.5rem', color: T.colorTextSecondary,
                      }}
                    >行间</button>
                    <button
                      onClick={() => handleDelete(s.name)}
                      title="Delete" style={{
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
    </>
  );
};

export default StickerPanel;
