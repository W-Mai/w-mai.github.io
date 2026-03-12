import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface ImageInfo {
  name: string;
  size: number;
  ext: string;
}

interface Props {
  slug: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PostImageManager: FC<Props> = ({ slug }) => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/editor/posts/${slug}/images`);
      if (res.ok) setImages(await res.json());
    } catch { /* ignore */ }
  }, [slug]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

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
    const md = `![${name}](./${name})`;
    navigator.clipboard.writeText(md);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="neu-btn"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 40,
          padding: '0.625rem 1rem',
          borderRadius: T.radiusMd,
          fontSize: T.fontSizeSm,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: T.colorText,
          background: T.colorBg,
        }}
      >
        🖼️ <span>{images.length}</span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 40,
        width: '20rem',
        maxHeight: '70vh',
        borderRadius: T.radiusXl,
        background: T.colorBg,
        boxShadow: T.shadowRaised,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: T.fontSans,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${T.spacingLg} ${T.spacingXl}`,
        borderBottom: `1px solid ${T.colorBorderLight}`,
      }}>
        <span style={{ fontSize: T.fontSizeMd, fontWeight: 600, color: T.colorAccent }}>
          🖼️ Images ({images.length})
        </span>
        <button
          onClick={() => setExpanded(false)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: T.fontSizeMd, color: T.colorTextMuted, padding: '0.25rem',
          }}
        >✕</button>
      </div>

      {/* Drop zone + upload */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          margin: `${T.spacingMd} ${T.spacingXl}`,
          padding: T.spacingLg,
          borderRadius: T.radiusMd,
          boxShadow: T.shadowInset,
          textAlign: 'center',
          fontSize: T.fontSizeXs,
          color: T.colorTextMuted,
          cursor: 'pointer',
        }}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? 'Uploading...' : 'Drop images here or click to upload'}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Image list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: `0 ${T.spacingXl} ${T.spacingLg}`,
      }}>
        {images.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: T.colorTextMuted,
            fontSize: T.fontSizeXs,
            padding: T.spacingXl,
          }}>No images yet</div>
        )}
        {images.map((img) => (
          <div
            key={img.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: T.spacingMd,
              padding: `${T.spacingSm} 0`,
              borderBottom: `1px solid ${T.colorBorderLight}`,
            }}
          >
            {/* Thumbnail */}
            <img
              src={`/api/editor/posts/${slug}/images/${img.name}`}
              alt={img.name}
              style={{
                width: '2.5rem',
                height: '2.5rem',
                objectFit: 'cover',
                borderRadius: T.radiusSm,
                boxShadow: T.shadowInset,
                flexShrink: 0,
              }}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: T.fontSizeXs,
                color: T.colorText,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{img.name}</div>
              <div style={{
                fontSize: '0.625rem',
                color: T.colorTextMuted,
              }}>{formatSize(img.size)}</div>
            </div>
            {/* Actions */}
            <button
              onClick={() => copyRef(img.name)}
              title="Copy markdown reference"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: T.fontSizeSm, padding: '0.25rem',
                color: copied === img.name ? T.colorSuccess : T.colorTextMuted,
              }}
            >{copied === img.name ? '✓' : '📋'}</button>
            <button
              onClick={() => handleDelete(img.name)}
              title="Delete image"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: T.fontSizeSm, padding: '0.25rem',
                color: T.colorTextMuted,
              }}
            >🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PostImageManager;
