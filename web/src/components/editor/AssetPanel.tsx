import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { pinyin } from 'pinyin-pro';
import { normalizeAssetName, validateAssetName } from '../../lib/editor-utils';
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
  onInsert?: (mdxRef: string) => void;
}

interface PendingUpload {
  file: File;
  originalName: string;
  finalName: string;
  manuallyEdited: boolean;
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Convert non-ASCII filename to pinyin-based name, preserving extension */
function filenameToPinyin(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : '';
  const py = pinyin(base, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  const slug = py.join('-').toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'file'}${ext.toLowerCase()}`;
}

/** Generate a compliant name: try normalizeAssetName first, fallback to pinyin */
function autoName(originalName: string): string {
  const normalized = normalizeAssetName(originalName);
  if (validateAssetName(normalized)) return normalized;
  return filenameToPinyin(originalName);
}

const AssetPanel: FC<AssetPanelProps> = ({ aiEnabled = false, onInsert }) => {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<AssetInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload naming dialog state
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

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

  const existingNames = new Set(assets.map((a) => a.name));

  const validateName = useCallback((name: string): string | null => {
    if (!name) return 'Name is required';
    if (!validateAssetName(name)) return 'Must be lowercase letters, digits, hyphens, underscores with extension';
    if (existingNames.has(name)) return 'This name already exists';
    return null;
  }, [existingNames]);

  /** Open naming dialog instead of uploading directly */
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const generated = autoName(file.name);
    setPending({ file, originalName: file.name, finalName: generated, manuallyEdited: false });
    setNameError(validateName(generated));
    setAiSuggestions([]);
    setAiLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [validateName]);

  const handleNameChange = (value: string) => {
    if (!pending) return;
    setPending({ ...pending, finalName: value, manuallyEdited: true });
    setNameError(validateName(value));
  };

  const handleAIGenerate = async () => {
    if (!pending || aiLoading) return;
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch('/api/editor/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest-asset-name', content: pending.originalName }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.chunk) fullText += parsed.chunk;
              if (parsed.result) fullText = parsed.result;
            } catch {}
          }
        }
      }
      const match = fullText.match(/\[[\s\S]*?\]/);
      if (match) {
        const names: string[] = JSON.parse(match[0]);
        const valid = names.filter((n) => typeof n === 'string' && validateAssetName(n));
        setAiSuggestions(valid.slice(0, 3));
        if (valid.length > 0) {
          setPending((p) => p ? { ...p, finalName: valid[0], manuallyEdited: true } : p);
          setNameError(validateName(valid[0]));
        }
      }
    } catch {
      setNameError('AI name generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const selectSuggestion = (name: string) => {
    if (!pending) return;
    setPending({ ...pending, finalName: name, manuallyEdited: true });
    setNameError(validateName(name));
  };

  const confirmUpload = async () => {
    if (!pending || nameError) return;
    setPending(null);
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/editor/assets/${encodeURIComponent(pending.finalName)}`, {
        method: 'POST',
        body: pending.file,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to upload ${pending.finalName}`);
      }
      await fetchAssets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    setPending(null);
    setAiSuggestions([]);
    setNameError(null);
  };

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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: `${T.spacingSm} ${T.spacingMd}`,
    border: `1px solid ${nameError ? T.colorError : T.colorBorder}`,
    borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
    fontFamily: T.fontMono, outline: 'none', boxSizing: 'border-box',
    transition: `border-color ${T.transitionFast}`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Upload naming dialog */}
      {pending && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.3)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) cancelUpload(); }}>
          <div style={{
            background: T.colorBg, borderRadius: T.radiusLg,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            padding: T.spacingXl, width: '400px', fontFamily: T.fontSans,
          }}>
            <div style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText, marginBottom: T.spacingLg }}>
              Upload Asset
            </div>
            <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: T.spacingLg }}>
              Original: {pending.originalName}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingSm, marginBottom: T.spacingXs }}>
              <label style={{ fontSize: T.fontSizeXs, color: T.colorTextSecondary, fontWeight: 500 }}>
                Filename
              </label>
              {aiEnabled && (
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading}
                  title="Use AI to generate filename"
                  style={{
                    background: 'none', border: `1px solid ${T.colorBorder}`,
                    borderRadius: T.radiusSm, padding: '0 0.4rem',
                    fontSize: T.fontSizeXs, color: aiLoading ? T.colorTextMuted : T.colorAccent,
                    cursor: aiLoading ? 'wait' : 'pointer', lineHeight: '1.6',
                    transition: `all ${T.transitionFast}`,
                  }}
                >
                  {aiLoading ? '⏳ Generating...' : '✨ AI'}
                </button>
              )}
            </div>
            <input
              type="text"
              value={pending.finalName}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !nameError) confirmUpload();
                if (e.key === 'Escape') cancelUpload();
              }}
              autoFocus
              style={inputStyle}
            />

            {aiSuggestions.length > 1 && (
              <div style={{ display: 'flex', gap: T.spacingSm, flexWrap: 'wrap', marginTop: T.spacingSm }}>
                {aiSuggestions.map((s) => (
                  <button key={s} onClick={() => selectSuggestion(s)} style={{
                    background: pending.finalName === s ? T.colorAccent : T.colorBgTertiary,
                    color: pending.finalName === s ? T.colorBg : T.colorTextSecondary,
                    border: 'none', borderRadius: T.radiusSm,
                    padding: `0.15rem ${T.spacingMd}`,
                    fontSize: T.fontSizeXs, fontFamily: T.fontMono,
                    cursor: 'pointer', transition: `all ${T.transitionFast}`,
                  }}>{s}</button>
                ))}
              </div>
            )}

            {nameError && (
              <div style={{ color: T.colorError, fontSize: T.fontSizeXs, marginTop: T.spacingXs }}>{nameError}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: T.spacingMd, marginTop: T.spacingLg }}>
              <button onClick={cancelUpload} style={{
                padding: `${T.spacingSm} ${T.spacingLg}`, background: 'none',
                border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm, color: T.colorTextSecondary, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={confirmUpload} disabled={!!nameError} style={{
                padding: `${T.spacingSm} ${T.spacingLg}`,
                background: nameError ? T.colorBorder : T.colorAccent,
                color: nameError ? T.colorTextMuted : T.colorBg,
                border: 'none', borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm, fontWeight: 500,
                cursor: nameError ? 'default' : 'pointer',
              }}>Upload</button>
            </div>
          </div>
        </div>
      )}

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
