import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from './shared/editor-tokens';

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

interface StickerPickerProps {
  /** Screen position to anchor the picker */
  position: { x: number; y: number };
  /** Called with selected sticker name */
  onSelect: (name: string) => void;
  onClose: () => void;
}

const StickerPicker: FC<StickerPickerProps> = ({ position, onSelect, onClose }) => {
  const [stickers, setStickers] = useState<StickerInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/editor/stickers')
      .then(r => r.json())
      .then((data: StickerInfo[]) => { setStickers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Auto-focus search input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape or click outside
  useEffect(() => {
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
  }, [onClose]);

  const filtered = filter
    ? stickers.filter(s => {
        const q = filter.toLowerCase();
        if (s.name.toLowerCase().includes(q)) return true;
        if (!s.meta) return false;
        if (s.meta.aiName?.toLowerCase().includes(q)) return true;
        if (s.meta.description?.toLowerCase().includes(q)) return true;
        if (s.meta.tags?.some(t => t.toLowerCase().includes(q))) return true;
        return false;
      })
    : stickers;

  // Clamp position so panel stays within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 340),
    left: Math.min(position.x, window.innerWidth - 320),
    width: '300px', maxHeight: '320px',
    background: T.colorBg, borderRadius: T.radiusMd,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column',
    zIndex: 2500, fontFamily: T.fontSans,
    overflow: 'hidden',
  };

  return (
    <div ref={panelRef} style={style}>
      {/* Search bar */}
      <div style={{
        padding: '6px 8px',
        borderBottom: `1px solid ${T.colorBorderLight}`,
      }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search stickers..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            width: '100%', padding: '4px 8px',
            border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
            fontSize: T.fontSizeSm, background: T.colorBgSecondary,
            color: T.colorText, outline: 'none',
          }}
        />
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
        {loading ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: T.colorTextMuted, fontSize: T.fontSizeSm }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: T.colorTextMuted, fontSize: T.fontSizeSm }}>
            {stickers.length === 0 ? 'No stickers' : 'No matches'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
            gap: '4px',
          }}>
            {filtered.map(s => (
              <button
                key={s.name}
                onClick={() => onSelect(s.name)}
                title={s.name.replace(/\.[^.]+$/, '')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '4px', background: T.colorBgSecondary,
                  border: 'none', borderRadius: T.radiusSm,
                  cursor: 'pointer', transition: `background ${T.transitionFast}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.colorBgTertiary; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.colorBgSecondary; }}
              >
                <img
                  src={`/api/editor/stickers/${encodeURIComponent(s.name)}`}
                  alt={s.name}
                  loading="lazy"
                  style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                />
                <span style={{
                  fontSize: '0.45rem', color: T.colorTextMuted,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', width: '100%', textAlign: 'center',
                  marginTop: '2px',
                }}>
                  {s.meta?.aiName || s.name.replace(/\.[^.]+$/, '')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerPicker;
