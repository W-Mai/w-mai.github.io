import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import AssetNameDialog from './AssetName';
import { EDITOR_TOKENS as T } from '../../shared/editor-tokens';

interface AssetInfo {
  name: string;
  size: number;
  ext: string;
  refCount: number;
  referencedBy: string[];
}

interface AssetPanelProps {
  aiEnabled?: boolean;
  refreshKey?: number;
  onInsert?: (mdxRef: string) => void;
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AssetPanel: FC<AssetPanelProps> = ({ aiEnabled = false, refreshKey = 0, onInsert }) => {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<AssetInfo | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewAsset, setPreviewAsset] = useState<string | null>(null);
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

  useEffect(() => { fetchAssets(); }, [fetchAssets, refreshKey]);

  const existingNames = new Set(assets.map((a) => a.name));

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingFile(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const confirmUpload = useCallback(async (file: File, finalName: string) => {
    setPendingFile(null);
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/editor/assets/${encodeURIComponent(finalName)}`, {
        method: 'POST', body: file,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to upload ${finalName}`);
      }
      await fetchAssets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [fetchAssets]);

  const requestDelete = useCallback((asset: AssetInfo) => {
    if (asset.refCount > 0) { setDeleteWarning(asset); return; }
    if (!confirm(`Delete "${asset.name}"?`)) return;
    performDelete(asset.name);
  }, []);

  const performDelete = useCallback(async (name: string) => {
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
    if (onInsert) { onInsert(ref); } else { navigator.clipboard.writeText(ref); }
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 1500);
  }, [onInsert]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Image preview lightbox */}
      {previewAsset && (
        <div
          onClick={() => setPreviewAsset(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={`/api/editor/assets/${encodeURIComponent(previewAsset)}`}
            alt={previewAsset}
            style={{
              maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
              borderRadius: T.radiusMd, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      )}

      {/* Asset naming dialog */}
      <AssetNameDialog
        file={pendingFile}
        aiEnabled={aiEnabled}
        existingNames={existingNames}
        onConfirm={confirmUpload}
        onCancel={() => setPendingFile(null)}
      />

      {/* Delete warning modal */}
      {deleteWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.3)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) setDeleteWarning(null); }}>
          <div style={{
            background: T.colorBg, borderRadius: T.radiusLg,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            padding: T.spacingXl, width: '320px', fontFamily: T.fontSans,
          }}>
            <div style={{ fontSize: T.fontSizeMd, fontWeight: 600, color: T.colorError, marginBottom: T.spacingMd }}>
              Cannot Delete
            </div>
            <div style={{ fontSize: T.fontSizeSm, color: T.colorText, marginBottom: T.spacingSm }}>
              "{deleteWarning.name}" is referenced by {deleteWarning.refCount} post{deleteWarning.refCount > 1 ? 's' : ''}:
            </div>
            <ul style={{ margin: `${T.spacingXs} 0`, paddingLeft: T.spacingXl, fontSize: T.fontSizeXs, color: T.colorTextSecondary }}>
              {deleteWarning.referencedBy.map((slug) => <li key={slug}>{slug}</li>)}
            </ul>
            <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginTop: T.spacingSm }}>
              Remove all references before deleting this asset.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: T.spacingLg }}>
              <button onClick={() => setDeleteWarning(null)} style={{
                padding: `${T.spacingSm} ${T.spacingLg}`,
                background: T.colorAccent, color: T.colorBg,
                border: 'none', borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm, cursor: 'pointer',
              }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload area — neumorphism styled */}
      <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} style={{
        padding: T.spacingXl,
      }}>
        <input ref={fileInputRef} type="file" multiple={false} accept="image/*,.pdf"
          onChange={(e) => handleFileSelect(e.target.files)} style={{ display: 'none' }} />
        <button
          className="editor-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%', padding: `${T.spacingLg} ${T.spacingXl}`,
            background: T.colorBg, border: 'none',
            borderRadius: T.radiusMd, cursor: 'pointer',
            fontSize: T.fontSizeSm, color: T.colorTextSecondary,
            boxShadow: T.shadowBtn,
            transition: `all 0.2s ease`,
          }}
        >
          {uploading ? '⏳ Uploading...' : '📁 Upload / Drop files'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: `${T.spacingSm} ${T.spacingXl}`,
          color: T.colorError, fontSize: T.fontSizeXs,
          display: 'flex', alignItems: 'center', gap: T.spacingXs,
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{
            background: 'none', border: 'none', color: T.colorError, cursor: 'pointer', fontSize: T.fontSizeMd,
          }}>×</button>
        </div>
      )}

      {/* Asset grid */}
      <div className="editor-scrollbar-hide" style={{ flex: 1, overflow: 'auto', padding: T.spacingXl }}>
        {isLoading && assets.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeMd, textAlign: 'center' }}>Loading...</div>
        ) : assets.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeMd, textAlign: 'center' }}>No assets yet</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: T.spacingXl,
          }}>
            {assets.map((asset, idx) => {
              const isImage = IMAGE_EXTS.includes(asset.ext);
              return (
                <div
                  key={asset.name}
                  className="editor-btn"
                  style={{
                    display: 'flex', flexDirection: 'column',
                    background: T.colorBg, borderRadius: T.radiusMd,
                    boxShadow: T.shadowBtn,
                    overflow: 'hidden', cursor: 'default',
                    transition: 'all 0.2s ease',
                    animation: 'editorPanelItemIn 0.2s ease both',
                    animationDelay: `${Math.min(idx * 30, 600)}ms`,
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    onClick={() => isImage && setPreviewAsset(asset.name)}
                    style={{
                      width: '100%', aspectRatio: '1', overflow: 'hidden',
                      background: T.colorBgTertiary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: isImage ? 'zoom-in' : 'default',
                    }}
                  >
                    {isImage ? (
                      <img
                        src={`/api/editor/assets/${encodeURIComponent(asset.name)}`}
                        alt={asset.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{
                        fontSize: T.fontSizeLg, color: T.colorTextMuted, fontWeight: 600,
                      }}>
                        {asset.ext.replace('.', '').toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div style={{ padding: T.spacingMd, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{
                      fontSize: T.fontSizeXs, color: T.colorText,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={asset.name}>
                      {asset.name}
                    </div>
                    <div style={{
                      fontSize: T.fontSizeXs, color: T.colorTextMuted,
                      display: 'flex', alignItems: 'center', gap: T.spacingSm,
                    }}>
                      <span>{formatSize(asset.size)}</span>
                      {asset.refCount > 0 && (
                        <span title={`Referenced by: ${asset.referencedBy.join(', ')}`} style={{ color: T.colorWarning }}>
                          {asset.refCount} ref{asset.refCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Action row */}
                    <div style={{ display: 'flex', gap: T.spacingSm, marginTop: T.spacingXs }}>
                      <button onClick={() => copyRef(asset.name)} title="Copy MDX reference path" style={{
                        flex: 1, background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: T.fontSizeXs,
                        color: copiedName === asset.name ? T.colorSuccess : T.colorTextMuted,
                        padding: '2px 0', transition: `color ${T.transitionFast}`,
                      }}>{copiedName === asset.name ? '✓ Copied' : '📋 Copy'}</button>
                      <button
                        onClick={() => requestDelete(asset)}
                        title={asset.refCount > 0 ? `Referenced by ${asset.refCount} post(s)` : `Delete ${asset.name}`}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: asset.refCount > 0 ? T.colorTextMuted : T.colorTextMuted,
                          fontSize: T.fontSizeXs, padding: '2px 0',
                          transition: `color ${T.transitionFast}`,
                          opacity: asset.refCount > 0 ? 0.4 : 1,
                        }}
                        onMouseEnter={(e) => { if (asset.refCount === 0) e.currentTarget.style.color = T.colorError; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = T.colorTextMuted; }}
                      >✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetPanel;
