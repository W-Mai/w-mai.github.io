import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface EnvConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Known env var definitions with labels and descriptions */
const ENV_SCHEMA: { key: string; label: string; desc: string; secret?: boolean }[] = [
  { key: 'OPENAI_API_BASE', label: 'OpenAI API Base', desc: 'Base URL for OpenAI-compatible API' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', desc: 'API key for AI text features', secret: true },
  { key: 'OPENAI_MODEL', label: 'OpenAI Model', desc: 'Model name (default: gpt-4o-mini)' },
  { key: 'ARK_API_KEY', label: 'Volcengine ARK Key', desc: 'API key for doubao vision model', secret: true },
];

const EnvConfigPanel: FC<EnvConfigPanelProps> = ({ isOpen, onClose }) => {
  const [vars, setVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch env vars on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    fetch('/api/editor/env')
      .then(r => r.json())
      .then((data: Record<string, string>) => { setVars(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [isOpen]);

  // Close on Escape or outside click
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

  const handleChange = useCallback((key: string, value: string) => {
    setVars(prev => ({ ...prev, [key]: value }));
    setSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // Filter out empty values
      const toSave: Record<string, string> = {};
      for (const [k, v] of Object.entries(vars)) {
        if (v.trim()) toSave[k] = v.trim();
      }
      const res = await fetch('/api/editor/env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [vars]);

  const toggleReveal = useCallback((key: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2500,
      background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div ref={panelRef} style={{
        width: '480px', maxWidth: '90vw', maxHeight: '80vh',
        background: T.colorBg, borderRadius: T.radiusLg,
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
        fontFamily: T.fontSans, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${T.spacingMd} ${T.spacingLg}`,
          borderBottom: `1px solid ${T.colorBorder}`,
        }}>
          <span style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText }}>
            ⚙️ Environment Variables
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: T.fontSizeBase, color: T.colorTextMuted, padding: '2px 6px',
          }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: T.spacingLg }}>
          {loading ? (
            <div style={{ padding: T.spacingXl, textAlign: 'center', color: T.colorTextMuted }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: T.spacingMd }}>
              {ENV_SCHEMA.map(({ key, label, desc, secret }) => (
                <div key={key}>
                  <label style={{
                    display: 'block', fontSize: T.fontSizeSm, fontWeight: 600,
                    color: T.colorTextSecondary, marginBottom: '2px',
                  }}>
                    {label}
                  </label>
                  <div style={{ fontSize: '0.65rem', color: T.colorTextMuted, marginBottom: '4px' }}>
                    {desc}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type={secret && !revealedKeys.has(key) ? 'password' : 'text'}
                      value={vars[key] || ''}
                      onChange={e => handleChange(key, e.target.value)}
                      placeholder={`Enter ${key}`}
                      style={{
                        flex: 1, padding: `${T.spacingXs} ${T.spacingSm}`,
                        background: T.colorBg, border: `1px solid ${T.colorBorderLight}`,
                        borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
                        fontFamily: T.fontMono, color: T.colorText,
                        boxShadow: T.shadowInset, outline: 'none',
                      }}
                    />
                    {secret && (
                      <button
                        onClick={() => toggleReveal(key)}
                        title={revealedKeys.has(key) ? 'Hide' : 'Show'}
                        style={{
                          background: 'none', border: `1px solid ${T.colorBorderLight}`,
                          borderRadius: T.radiusSm, cursor: 'pointer',
                          padding: `0 ${T.spacingSm}`, fontSize: T.fontSizeSm,
                          color: T.colorTextMuted,
                        }}
                      >
                        {revealedKeys.has(key) ? '🙈' : '👁'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Show any extra vars not in schema */}
              {Object.keys(vars)
                .filter(k => !ENV_SCHEMA.some(s => s.key === k))
                .map(key => (
                  <div key={key}>
                    <label style={{
                      display: 'block', fontSize: T.fontSizeSm, fontWeight: 600,
                      color: T.colorTextSecondary, marginBottom: '2px',
                    }}>
                      {key}
                    </label>
                    <input
                      type="text"
                      value={vars[key] || ''}
                      onChange={e => handleChange(key, e.target.value)}
                      style={{
                        width: '100%', padding: `${T.spacingXs} ${T.spacingSm}`,
                        background: T.colorBg, border: `1px solid ${T.colorBorderLight}`,
                        borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
                        fontFamily: T.fontMono, color: T.colorText,
                        boxShadow: T.shadowInset, outline: 'none',
                      }}
                    />
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{
            padding: `${T.spacingSm} ${T.spacingLg}`, background: T.colorErrorBg,
            color: T.colorError, fontSize: T.fontSizeXs,
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: T.spacingSm,
          padding: `${T.spacingMd} ${T.spacingLg}`,
          borderTop: `1px solid ${T.colorBorder}`,
        }}>
          {success && (
            <span style={{ fontSize: T.fontSizeSm, color: '#16a34a', marginRight: 'auto' }}>
              ✓ Saved
            </span>
          )}
          <span style={{ fontSize: '0.6rem', color: T.colorTextMuted, marginRight: 'auto' }}>
            Saved to .env (git-ignored)
          </span>
          <button onClick={onClose} style={{
            padding: `${T.spacingXs} ${T.spacingMd}`,
            background: 'none', border: `1px solid ${T.colorBorder}`,
            borderRadius: T.radiusSm, cursor: 'pointer',
            fontSize: T.fontSizeSm, color: T.colorTextSecondary,
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: `${T.spacingXs} ${T.spacingMd}`,
            background: T.colorAccent, border: 'none',
            borderRadius: T.radiusSm, cursor: saving ? 'wait' : 'pointer',
            fontSize: T.fontSizeSm, color: '#fff', fontWeight: 500,
          }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnvConfigPanel;
