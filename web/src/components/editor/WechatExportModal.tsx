import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';
import { EDITOR_TOKENS as T } from './editor-tokens';
import { WECHAT_TEMPLATES, applyTemplate } from '../../lib/wechat-templates';

const STORAGE_KEY = 'editor:wechatTemplateId';

interface WechatExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  content: string;
}

/** Read persisted template ID from localStorage, fallback to first template */
function getDefaultTemplateId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && WECHAT_TEMPLATES.some((t) => t.id === stored)) return stored;
  } catch { /* localStorage unavailable */ }
  return WECHAT_TEMPLATES[0].id;
}

/** Persist selected template ID to localStorage */
function persistTemplateId(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

/** Wrap styled HTML in a minimal document for iframe srcdoc */
function buildSrcdoc(html: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{max-width:375px;margin:0 auto;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#333;word-wrap:break-word;overflow-wrap:break-word}</style>
</head><body>${html}</body></html>`;
}

const WechatExportModal: FC<WechatExportModalProps> = ({
  isOpen, onClose, slug, content,
}) => {
  const [templateId, setTemplateId] = useState(getDefaultTemplateId);
  const [taggedHtml, setTaggedHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copyError, setCopyError] = useState('');
  const [closing, setClosing] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTemplate = WECHAT_TEMPLATES.find((t) => t.id === templateId) ?? WECHAT_TEMPLATES[0];

  // Fetch tagged HTML when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTaggedHtml('');
    setCopyStatus('idle');

    fetch('/api/editor/wechat-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, slug }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setTaggedHtml(data.html);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to convert content');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, content, slug]);

  // Animated close: play exit animation then call onClose
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
  }, []);

  const handleTemplateChange = useCallback((id: string) => {
    setTemplateId(id);
    persistTemplateId(id);
  }, []);

  const styledHtml = taggedHtml ? applyTemplate(taggedHtml, currentTemplate) : '';

  const handleCopy = useCallback(async () => {
    if (!styledHtml) return;
    try {
      const blob = new Blob([styledHtml], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      setCopyStatus('success');
      setCopyError('');
    } catch (err: any) {
      setCopyStatus('error');
      setCopyError(err.message || 'Clipboard write failed');
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
  }, [styledHtml]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`editor-overlay${closing ? ' closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'var(--editor-overlay-bg, rgba(0,0,0,0.3))', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        className={`editor-panel${closing ? ' closing' : ''}`}
        style={{
          background: T.colorBg, borderRadius: T.radiusXl,
          boxShadow: T.shadowRaised,
          padding: T.spacingXl, width: '480px', maxWidth: '95vw',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          fontFamily: T.fontSans,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: T.spacingLg,
        }}>
          <span style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText }}>
            📤 WeChat Export
          </span>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', fontSize: T.fontSizeLg,
              color: T.colorTextMuted, cursor: 'pointer', padding: T.spacingXs,
              lineHeight: 1, transition: `color ${T.transitionFast}`,
            }}
          >
            ✕
          </button>
        </div>

        {/* Template selector tabs */}
        <div style={{
          display: 'flex', gap: T.spacingSm,
          padding: T.spacingSm, borderRadius: T.radiusMd,
          boxShadow: T.shadowInset, marginBottom: T.spacingLg,
        }}>
          {WECHAT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleTemplateChange(tpl.id)}
              title={tpl.description}
              className={templateId !== tpl.id ? 'editor-btn' : ''}
              style={{
                flex: 1, padding: `${T.spacingSm} ${T.spacingMd}`,
                border: 'none', borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm, cursor: 'pointer',
                fontWeight: templateId === tpl.id ? 600 : 400,
                color: templateId === tpl.id ? T.colorText : T.colorTextSecondary,
                background: templateId === tpl.id
                  ? 'linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light))'
                  : 'transparent',
                boxShadow: templateId === tpl.id ? T.shadowInset : 'none',
                transition: `all ${T.transitionFast}`,
              }}
            >
              {tpl.name}
            </button>
          ))}
        </div>

        {/* Preview area */}
        <div style={{
          flex: 1, minHeight: 0, borderRadius: T.radiusMd,
          boxShadow: T.shadowInset, overflow: 'hidden',
          marginBottom: T.spacingLg,
        }}>
          {loading && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '200px', color: T.colorTextMuted, fontSize: T.fontSizeSm,
            }}>
              Converting…
            </div>
          )}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '200px', color: T.colorError, fontSize: T.fontSizeSm,
              padding: T.spacingLg, textAlign: 'center',
            }}>
              {error}
            </div>
          )}
          {!loading && !error && styledHtml && (
            <iframe
              title="WeChat preview"
              srcDoc={buildSrcdoc(styledHtml)}
              sandbox="allow-same-origin"
              style={{
                width: '100%', height: '700px', border: 'none',
                borderRadius: T.radiusMd, background: '#fff',
              }}
            />
          )}
        </div>

        {/* Footer: copy button + status */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: T.spacingMd,
        }}>
          <div style={{ fontSize: T.fontSizeXs, minHeight: '1.2em' }}>
            {copyStatus === 'success' && (
              <span style={{ color: T.colorSuccess }}>✓ Copied to clipboard</span>
            )}
            {copyStatus === 'error' && (
              <span style={{ color: T.colorError }}>{copyError}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: T.spacingMd }}>
            <button
              onClick={handleClose}
              className="editor-btn"
              style={{
                padding: `${T.spacingSm} ${T.spacingLg}`, background: T.colorBg,
                border: 'none', borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm, color: T.colorTextSecondary, cursor: 'pointer',
                transition: `all ${T.transitionFast}`,
                boxShadow: T.shadowBtn,
              }}
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              disabled={loading || !!error || !styledHtml}
              className={!(loading || error || !styledHtml) ? 'editor-btn' : ''}
              style={{
                padding: `${T.spacingSm} ${T.spacingLg}`,
                background: loading || error || !styledHtml ? T.colorBorder : T.colorAccent,
                color: loading || error || !styledHtml ? T.colorTextMuted : T.colorBg,
                border: 'none', borderRadius: T.radiusSm,
                fontSize: T.fontSizeSm, fontWeight: 500,
                cursor: loading || error || !styledHtml ? 'default' : 'pointer',
                boxShadow: T.shadowBtn,
                transition: `all ${T.transitionFast}`,
              }}
            >
              📋 Copy
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WechatExportModal;
