import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import AssetNameDialog from './AssetNameDialog';
import { EDITOR_TOKENS as T } from './editor-tokens';

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

      {/* Upload area */}
      <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} style={{
        padding: T.spacingMd, borderBottom: `1px solid ${T.colorBorder}`,
        display: 'flex', flexDirection: 'column', gap: T.spacingSm,
      }}>
        <input ref={fileInputRef} type="file" multiple={false} accept="image/*,.pdf"
          onChange={(e) => handleFileSelect(e.target.files)} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
          width: '100%', padding: '0.4rem',
          background: T.colorBgTertiary, border: `1px dashed #d1d5db`,
          borderRadius: T.radiusMd, cursor: 'pointer',
          fontSize: T.fontSizeSm, color: T.colorTextSecondary,
          transition: `all ${T.transitionFast}`,
        }}>
          {uploading ? 'Uploading...' : '📁 Upload / Drop files'}
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

      {/* Asset list */}
      <div style={{ flex: 1, overflow: 'auto', padding: `${T.spacingXs} 0` }}>
        {isLoading && assets.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeMd, textAlign: 'center' }}>Loading...</div>
        ) : assets.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeMd, textAlign: 'center' }}>No assets yet</div>
        ) : (
          assets.map((asset) => {
            const isImage = IMAGE_EXTS.includes(asset.ext);
            return (
              <div key={asset.name} style={{
                display: 'flex', alignItems: 'center', gap: T.spacingMd,
                padding: `${T.spacingSm} ${T.spacingMd}`,
                borderBottom: `1px solid ${T.colorBorderLight}`, fontSize: T.fontSizeSm,
              }}>
                {isImage ? (
                  <img src={`/api/editor/assets/${encodeURIComponent(asset.name)}`} alt={asset.name} style={{
                    width: '32px', height: '32px', objectFit: 'cover',
                    borderRadius: T.radiusSm, border: `1px solid ${T.colorBorder}`, flexShrink: 0,
                  }} />
                ) : (
                  <div style={{
                    width: '32px', height: '32px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: T.colorBgTertiary, borderRadius: T.radiusSm,
                    fontSize: T.fontSizeXs, color: T.colorTextMuted, flexShrink: 0,
                  }}>{asset.ext.replace('.', '').toUpperCase()}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.colorText }}>
                    {asset.name}
                  </div>
                  <div style={{ color: T.colorTextMuted, fontSize: T.fontSizeXs, display: 'flex', gap: T.spacingSm }}>
                    <span>{formatSize(asset.size)}</span>
                    {asset.refCount > 0 && (
                      <span title={`Referenced by: ${asset.referencedBy.join(', ')}`} style={{ color: T.colorWarning }}>
                        {asset.refCount} ref{asset.refCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => copyRef(asset.name)} title="Copy MDX reference path" style={{
                  background: 'none', border: `1px solid ${T.colorBorder}`,
                  borderRadius: T.radiusSm, cursor: 'pointer',
                  fontSize: T.fontSizeXs, color: copiedName === asset.name ? T.colorSuccess : T.colorTextSecondary,
                  padding: `0.15rem 0.3rem`, flexShrink: 0, transition: `color ${T.transitionFast}`,
                }}>{copiedName === asset.name ? '✓' : '📋'}</button>
                <button onClick={() => requestDelete(asset)}
                  title={asset.refCount > 0 ? `Referenced by ${asset.refCount} post(s)` : `Delete ${asset.name}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: asset.refCount > 0 ? T.colorTextMuted : '#d1d5db',
                    fontSize: T.fontSizeXs, padding: '0.2rem', flexShrink: 0,
                    transition: `color ${T.transitionFast}`, opacity: asset.refCount > 0 ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { if (asset.refCount === 0) e.currentTarget.style.color = T.colorError; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = asset.refCount > 0 ? T.colorTextMuted : '#d1d5db'; }}
                >✕</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssetPanel;
