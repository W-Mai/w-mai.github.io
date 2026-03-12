import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface ImageInfo {
  name: string;
  size: number;
  ext: string;
}

interface Props {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (markdown: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PostImageManager: FC<Props> = ({ slug, isOpen, onClose, onInsert }) => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [hoveredImg, setHoveredImg] = useState<string | null>(null);
  const [imgWidths, setImgWidths] = useState<Record<string, number>>({});
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/editor/posts/${slug}/images`);
      if (res.ok) setImages(await res.json());
    } catch { /* ignore */ }
  }, [slug]);

  useEffect(() => { if (isOpen) fetchImages(); }, [isOpen, slug, fetchImages]);

  // Animate open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      setVisible(true);
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        await fetch(`/api/editor/posts/${slug}/images`, { method: 'POST', body: fd });
      }
      await fetchImages();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [slug, fetchImages]);

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    await fetch(`/api/editor/posts/${slug}/images?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    await fetchImages();
  }, [slug, fetchImages]);

  const copyRef = useCallback((name: string) => {
    navigator.clipboard.writeText(`./${name}`);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const insertImage = useCallback((name: string) => {
    const md = `![${name}](./${name})`;
    if (onInsert) onInsert(md);
    else navigator.clipboard.writeText(md);
  }, [onInsert]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  // Horizontal wheel scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (railRef.current && e.deltaY !== 0) {
      e.preventDefault();
      railRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        margin: `0 ${T.spacingLg}`,
        borderRadius: '2rem',
        animation: closing ? 'imageRailOut 0.35s ease both' : 'imageRailIn 0.35s ease both',
      }}
    >
      <style>{`
        @keyframes imageRailIn {
          from { max-height: 0; opacity: 0; }
          to { max-height: 12rem; opacity: 1; }
        }
        @keyframes imageRailOut {
          from { max-height: 12rem; opacity: 1; }
          to { max-height: 0; opacity: 0; }
        }
        .img-rail-item { transition: none; }
        .img-rail-item .img-rail-thumb { transition: transform 0.3s ease; }
        .img-rail-item:hover .img-rail-thumb { transform: translateY(-0.25rem); }
        .img-rail-label {
          max-width: var(--label-max, 5rem);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .img-rail-item:hover .img-rail-label {
          max-width: 20rem;
        }
        .img-rail-overlay {
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .img-rail-item:hover .img-rail-overlay {
          opacity: 1;
        }
        .img-rail-capsule {
          position: absolute;
          bottom: -0.25rem;
          left: 50%;
          transform: translateX(-50%) translateY(0.5rem) scale(0.92);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                      box-shadow 0.3s ease;
          z-index: 5;
        }
        .img-rail-item:hover .img-rail-capsule {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
          pointer-events: auto;
          box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
        }
      `}</style>

      {/* Inset shadow overlay — fixed, does not scroll */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '2rem',
        boxShadow: T.shadowInset,
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* Upload zone — absolute, outside scroll */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="neu-btn"
        style={{
          position: 'absolute',
          left: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 11,
          width: '2.5rem', height: '4.5rem',
          borderRadius: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          fontSize: uploading ? T.fontSizeXs : '1.5rem',
          color: T.colorTextMuted,
          border: 'none',
          lineHeight: 1,
          fontWeight: 300,
        }}
      >
        {uploading ? '⏳' : '+'}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Scrollable rail */}
      <div
        ref={railRef}
        onWheel={handleWheel}
        className="editor-scrollbar-hide"
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          background: T.colorBg,
        }}
      >
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          paddingLeft: '4rem',
          paddingRight: '2rem',
          height: '6.5rem',
          gap: T.spacingMd,
        }}>

        {/* Image items */}
          {images.length === 0 && !uploading && (
            <div style={{
              color: T.colorTextMuted,
              fontSize: T.fontSizeXs,
              whiteSpace: 'nowrap',
              padding: T.spacingLg,
            }}>No images — drop or click + to upload</div>
          )}
          {images.map((img) => (
            <div
              key={img.name}
              className="img-rail-item"
              onMouseEnter={() => setHoveredImg(img.name)}
              onMouseLeave={() => setHoveredImg(null)}
              style={{
                flexShrink: 0,
                position: 'relative',
                height: '4.5rem',
              }}
            >
              {/* Thumbnail — fixed height, proportional width */}
              <div className="img-rail-thumb" style={{
                height: '4.5rem',
                borderRadius: T.radiusLg,
                boxShadow: T.shadowBtn,
                overflow: 'hidden',
                background: T.colorBg,
                position: 'relative',
                display: 'flex',
              }}>
                <img
                  src={`/api/editor/posts/${slug}/images/${img.name}`}
                  alt={img.name}
                  style={{
                    height: '100%',
                    width: 'auto',
                    display: 'block',
                    objectFit: 'contain',
                  }}
                  loading="lazy"
                  onLoad={(e) => {
                    const el = e.target as HTMLImageElement;
                    setImgWidths((prev) => ({ ...prev, [img.name]: el.clientWidth }));
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* Hover overlay with actions */}
                <div className="img-rail-overlay" style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    borderRadius: T.radiusSm,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '4px',
                    pointerEvents: hoveredImg === img.name ? 'auto' : 'none',
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); insertImage(img.name); }}
                      title="Insert into editor"
                      style={actionBtnStyle}
                    >📥</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyRef(img.name); }}
                      title="Copy path"
                      style={actionBtnStyle}
                    >{copied === img.name ? '✓' : '📋'}</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(img.name); }}
                      title="Delete"
                      style={actionBtnStyle}
                    >🗑</button>
                  </div>
              </div>
              {/* Capsule: name + size */}
              <div
                className="img-rail-capsule"
                title={img.name}
                style={{
                  '--label-max': imgWidths[img.name] ? `${Math.round(imgWidths[img.name] * 1.2)}px` : '5rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  background: T.colorBg,
                  boxShadow: '1px 1px 2px var(--neu-shadow-dark), -1px -1px 2px var(--neu-shadow-light)',
                  fontSize: '0.5rem',
                  color: T.colorTextMuted,
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                } as React.CSSProperties}
              >
                <span className="img-rail-label">{img.name}</span>
                <span style={{ opacity: 0.6 }}>·</span>
                <span style={{ flexShrink: 0 }}>{formatSize(img.size)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  cursor: 'pointer', fontSize: '0.875rem',
  padding: '2px',
  filter: 'brightness(1.2)',
};

export default PostImageManager;
