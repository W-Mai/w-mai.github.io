import { useState, useEffect, useCallback, useRef, type FC } from 'react';

interface AssetInfo {
  name: string;
  size: number;
  ext: string;
}

interface AssetPanelProps {
  onInsert?: (mdxRef: string) => void;
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'];

/** Format file size to human-readable string */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AssetPanel: FC<AssetPanelProps> = ({ onInsert }) => {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/editor/assets');
      const data: AssetInfo[] = await res.json();
      setAssets(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const res = await fetch(`/api/editor/assets/${encodeURIComponent(file.name)}`, {
          method: 'POST',
          body: file,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
      }
      await fetchAssets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [fetchAssets]);

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/editor/assets/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      await fetchAssets();
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchAssets]);

  const copyRef = useCallback((name: string) => {
    const ref = `./assets/${name}`;
    if (onInsert) {
      onInsert(ref);
    } else {
      navigator.clipboard.writeText(ref);
    }
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 1500);
  }, [onInsert]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          padding: '0.5rem', borderBottom: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column', gap: '0.375rem',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => handleUpload(e.target.files)}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%', padding: '0.4rem',
            background: '#f3f4f6', border: '1px dashed #d1d5db',
            borderRadius: '0.375rem', cursor: 'pointer',
            fontSize: '0.75rem', color: '#6b7280',
            transition: 'all 0.15s',
          }}
        >
          {uploading ? 'Uploading...' : '📁 Upload / Drop files'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '0.375rem 0.5rem', background: '#fef2f2',
          color: '#dc2626', fontSize: '0.7rem',
          borderBottom: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}
          >×</button>
        </div>
      )}

      {/* Asset list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.25rem 0' }}>
        {isLoading && assets.length === 0 ? (
          <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center' }}>
            Loading...
          </div>
        ) : assets.length === 0 ? (
          <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center' }}>
            No assets yet
          </div>
        ) : (
          assets.map((asset) => {
            const isImage = IMAGE_EXTS.includes(asset.ext);
            return (
              <div
                key={asset.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.375rem 0.5rem',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '0.75rem',
                }}
              >
                {/* Thumbnail */}
                {isImage ? (
                  <img
                    src={`/api/editor/assets/${encodeURIComponent(asset.name)}`}
                    alt={asset.name}
                    style={{
                      width: '32px', height: '32px',
                      objectFit: 'cover', borderRadius: '0.25rem',
                      border: '1px solid #e5e7eb', flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f3f4f6', borderRadius: '0.25rem',
                    fontSize: '0.6rem', color: '#9ca3af', flexShrink: 0,
                  }}>
                    {asset.ext.replace('.', '').toUpperCase()}
                  </div>
                )}

                {/* Name + size */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', color: '#374151',
                  }}>
                    {asset.name}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
                    {formatSize(asset.size)}
                  </div>
                </div>

                {/* Copy ref button */}
                <button
                  onClick={() => copyRef(asset.name)}
                  title="Copy MDX reference path"
                  style={{
                    background: 'none', border: '1px solid #e5e7eb',
                    borderRadius: '0.25rem', cursor: 'pointer',
                    fontSize: '0.65rem', color: copiedName === asset.name ? '#10b981' : '#6b7280',
                    padding: '0.15rem 0.3rem', flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                >
                  {copiedName === asset.name ? '✓' : '📋'}
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(asset.name)}
                  title={`Delete ${asset.name}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#d1d5db', fontSize: '0.7rem', padding: '0.2rem',
                    flexShrink: 0, transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; }}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssetPanel;
