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
  const fileRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/editor/posts/${slug}/images`);
      if (res.ok) setImages(await res.json());
    } catch { /* ignore */ }
  }, [slug]);

  useEffect(() => { if (isOpen) fetchImages(); }, [isOpen, slug, fetchImages]);

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

  if (!isOpen) return null;

  return (
    <div
      style={{
        overflow: 'hidden',
        background: T.colorBg,
        borderBottom: `1px solid ${T.colorBorderLight}`,
        animation: 'imageRailIn 0.2s ease both',
      }}
    >
      <style>{`
        @keyframes imageRailIn {
          from { max-height: 0; opacity: 0; }
          to { max-height: 10rem; opacity: 1; }
        }
        .img-rail-item { transition: all 0.15s ease; }
        .img-rail-item:hover { transform: translateY(-2px); }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center',
        padding: `${T.spacingSm} ${T.spacingXl}`,
        gap: T.spacingMd,
      }}>
        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          style={{
            flexShrink: 0,
            width: '5rem', height: '5rem',
            borderRadius: T.radiusMd,
            boxShadow: T.shadowInset,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            fontSize: uploading ? T.fontSizeXs : '1.5rem',
            color: T.colorTextMuted,
          }}
        >
          {uploading ? '...' : '+'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {/* Horizontal scrollable image rail */}
        <div
          ref={railRef}
          onWheel={handleWheel}
          className="editor-scrollbar-hide"
          style={{
            flex: 1,
            display: 'flex',
            gap: T.spacingMd,
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: `${T.spacingSm} 0`,
          }}
        >
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
                width: '5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                position: 'relative',
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: '5rem', height: '5rem',
                borderRadius: T.radiusSm,
                boxShadow: T.shadowBtn,
                overflow: 'hidden',
                background: T.colorBg,
                position: 'relative',
              }}>
                <img
                  src={`/api/editor/posts/${slug}/images/${img.name}`}
                  alt={img.name}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* Hover overlay with actions */}
                {hoveredImg === img.name && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    borderRadius: T.radiusSm,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '4px',
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
                )}
              </div>
              {/* Filename */}
              <div style={{
                fontSize: '0.5625rem',
                color: T.colorTextMuted,
                width: '5rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }}>{img.name}</div>
              <div style={{
                fontSize: '0.5rem',
                color: T.colorTextMuted,
              }}>{formatSize(img.size)}</div>
            </div>
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            flexShrink: 0,
            background: 'none', border: 'none',
            cursor: 'pointer',
            color: T.colorTextMuted,
            fontSize: T.fontSizeSm,
            padding: T.spacingSm,
          }}
        >✕</button>
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
