import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

const POS_KEY = 'editor:stickerPanelPos';

function savePanelPos(pos: { x: number; y: number }) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
}

function loadPanelPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return typeof p.x === 'number' && typeof p.y === 'number' ? p : null;
  } catch { return null; }
}

interface StickerMeta {
  filename: string;
  aiName?: string;
  description?: string;
  tags?: string[];
}

interface StickerInfo {
  name: string;
  size: number;
  meta?: StickerMeta;
}

interface StickerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertInline?: (syntax: string) => void;
  onInsertBlock?: (syntax: string) => void;
}

/** Check if a sticker matches the search filter using meta info */
function matchesFilter(s: StickerInfo, q: string): boolean {
  const lower = q.toLowerCase();
  if (s.name.toLowerCase().includes(lower)) return true;
  if (!s.meta) return false;
  if (s.meta.aiName?.toLowerCase().includes(lower)) return true;
  if (s.meta.description?.toLowerCase().includes(lower)) return true;
  if (s.meta.tags?.some(t => t.toLowerCase().includes(lower))) return true;
  return false;
}

const StickerPanel: FC<StickerPanelProps> = ({ isOpen, onClose, onInsertInline, onInsertBlock }) => {
  const [stickers, setStickers] = useState<StickerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewSticker, setPreviewSticker] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(() => loadPanelPos());
  const [recognizing, setRecognizing] = useState<Set<string>>(new Set());
  const [recognizeAll, setRecognizeAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const abortRef = useRef(false);

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
    if (isOpen) fetchStickers();
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
    const handleMouseUp = () => {
      if (isDragging.current && panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        savePanelPos({ x: rect.left, y: rect.top });
      }
      isDragging.current = false;
    };
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

  // AI recognize a single sticker
  const handleRecognize = useCallback(async (name: string) => {
    setRecognizing(prev => new Set(prev).add(name));
    try {
      const res = await fetch('/api/editor/stickers/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recognition failed');
      // Update local sticker meta
      setStickers(prev => prev.map(s =>
        s.name === name ? { ...s, meta: data.meta } : s
      ));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRecognizing(prev => { const n = new Set(prev); n.delete(name); return n; });
    }
  }, []);

  // AI recognize all unrecognized stickers
  const handleRecognizeAll = useCallback(async () => {
    const unrecognized = stickers.filter(s => !s.meta?.aiName);
    if (unrecognized.length === 0) return;
    setRecognizeAll(true);
    abortRef.current = false;
    for (const s of unrecognized) {
      if (abortRef.current) break;
      await handleRecognize(s.name);
    }
    setRecognizeAll(false);
  }, [stickers, handleRecognize]);

  const handleStopRecognizeAll = useCallback(() => {
    abortRef.current = true;
  }, []);

  const filtered = filter
    ? stickers.filter(s => matchesFilter(s, filter))
    : stickers;

  const unrecognizedCount = stickers.filter(s => !s.meta?.aiName).length;

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
        width: '560px', maxWidth: '90vw', maxHeight: '70vh',
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

        {/* Search + Upload + AI */}
        <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} style={{
          display: 'flex', gap: T.spacingSm, flexWrap: 'wrap',
          padding: `${T.spacingSm} ${T.spacingLg}`,
          borderBottom: `1px solid ${T.colorBorderLight}`,
        }}>
          <input
            type="text" placeholder="Search by name, description, tags..."
            value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1, minWidth: '120px', padding: `4px ${T.spacingSm}`,
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
          {recognizeAll ? (
            <button onClick={handleStopRecognizeAll} style={{
              padding: `4px ${T.spacingMd}`,
              background: T.colorErrorBg, border: `1px solid ${T.colorError}`,
              borderRadius: T.radiusSm, cursor: 'pointer',
              fontSize: T.fontSizeSm, color: T.colorError,
            }}>
              ⏹ Stop
            </button>
          ) : (
            <button
              onClick={handleRecognizeAll}
              disabled={unrecognizedCount === 0}
              title={unrecognizedCount > 0 ? `AI recognize ${unrecognizedCount} stickers` : 'All stickers recognized'}
              style={{
                padding: `4px ${T.spacingMd}`,
                background: unrecognizedCount > 0 ? '#eff6ff' : T.colorBgTertiary,
                border: `1px solid ${unrecognizedCount > 0 ? '#93c5fd' : T.colorBorder}`,
                borderRadius: T.radiusSm, cursor: unrecognizedCount > 0 ? 'pointer' : 'default',
                fontSize: T.fontSizeSm,
                color: unrecognizedCount > 0 ? '#2563eb' : T.colorTextMuted,
              }}
            >
              🤖 AI ({unrecognizedCount})
            </button>
          )}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: T.spacingSm }}>
              {filtered.map((s) => {
                const isRecognizing = recognizing.has(s.name);
                const hasMeta = !!s.meta?.aiName;
                return (
                  <div key={s.name} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '4px', borderRadius: T.radiusSm,
                    background: T.colorBgSecondary, position: 'relative',
                    transition: `all ${T.transitionFast}`,
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = T.colorBgTertiary; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = T.colorBgSecondary; }}
                  >
                    {/* Meta indicator dot */}
                    {hasMeta && (
                      <div style={{
                        position: 'absolute', top: '3px', right: '3px',
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#22c55e',
                      }} title={`${s.meta!.aiName}\n${s.meta!.description}`} />
                    )}

                    <img
                      src={`/api/editor/stickers/${encodeURIComponent(s.name)}`}
                      alt={s.meta?.description || s.name}
                      onClick={() => setPreviewSticker(s.name)}
                      style={{ width: '48px', height: '48px', objectFit: 'contain', cursor: 'zoom-in' }}
                    />
                    <div style={{
                      fontSize: '0.5rem', color: T.colorTextMuted,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      width: '100%', textAlign: 'center', marginTop: '2px', maxWidth: '80px',
                    }} title={s.meta?.aiName ? `${s.meta.aiName}\n${s.meta.description}` : s.name}>
                      {s.meta?.aiName || s.name.replace(/\.[^.]+$/, '')}
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
                        onClick={() => handleRecognize(s.name)}
                        disabled={isRecognizing}
                        title={hasMeta ? 'Re-recognize with AI' : 'AI recognize'}
                        style={{
                          background: 'none', border: `1px solid ${T.colorBorder}`,
                          borderRadius: '3px', cursor: isRecognizing ? 'wait' : 'pointer',
                          padding: '1px 4px', fontSize: '0.5rem',
                          color: isRecognizing ? T.colorTextMuted : '#2563eb',
                          opacity: isRecognizing ? 0.6 : 1,
                        }}
                      >{isRecognizing ? '...' : '🤖'}</button>
                      <button
                        onClick={() => handleDelete(s.name)}
                        title="Delete" style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '1px 3px', fontSize: '0.55rem', color: 'var(--border-subtle)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = T.colorError; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--border-subtle)'; }}
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StickerPanel;
