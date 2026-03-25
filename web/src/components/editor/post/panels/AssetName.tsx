import { useState, useEffect, useCallback, type FC } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import { normalizeAssetName, validateAssetName } from '~/lib/editor/utils';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';

interface AssetNameDialogProps {
  file: File | null;
  aiEnabled: boolean;
  existingNames: Set<string>;
  onConfirm: (file: File, finalName: string) => void;
  onCancel: () => void;
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

const AssetNameDialog: FC<AssetNameDialogProps> = ({
  file, aiEnabled, existingNames, onConfirm, onCancel,
}) => {
  const [finalName, setFinalName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const validate = useCallback((name: string): string | null => {
    if (!name) return 'Name is required';
    if (!validateAssetName(name)) return 'Must be lowercase letters, digits, hyphens, underscores with extension';
    if (existingNames.has(name)) return 'This name already exists';
    return null;
  }, [existingNames]);

  useEffect(() => {
    if (file) {
      const generated = autoName(file.name);
      setFinalName(generated);
      setNameError(validate(generated));
      setAiSuggestions([]);
      setAiLoading(false);
    }
  }, [file, validate]);

  const handleNameChange = (value: string) => {
    setFinalName(value);
    setNameError(validate(value));
  };

  const handleAIGenerate = async () => {
    if (!file || aiLoading) return;
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch('/api/editor/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest-asset-name', content: file.name }),
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
          setFinalName(valid[0]);
          setNameError(validate(valid[0]));
        }
      }
    } catch {
      setNameError('AI name generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  if (!file) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.3)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: T.colorBg, borderRadius: T.radiusLg,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: T.spacingXl, width: '400px', fontFamily: T.fontSans,
      }}>
        <div style={{ fontSize: T.fontSizeBase, fontWeight: 600, color: T.colorText, marginBottom: T.spacingLg }}>
          Upload Asset
        </div>
        <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: T.spacingLg }}>
          Original: {file.name}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingSm, marginBottom: T.spacingXs }}>
          <label style={{ fontSize: T.fontSizeXs, color: T.colorTextSecondary, fontWeight: 500 }}>Filename</label>
          {aiEnabled && (
            <button onClick={handleAIGenerate} disabled={aiLoading} title="Use AI to generate filename" style={{
              background: 'none', border: `1px solid ${T.colorBorder}`,
              borderRadius: T.radiusSm, padding: '0 0.4rem',
              fontSize: T.fontSizeXs, color: aiLoading ? T.colorTextMuted : T.colorAccent,
              cursor: aiLoading ? 'wait' : 'pointer', lineHeight: '1.6',
              transition: `all ${T.transitionFast}`,
            }}>{aiLoading ? '⏳ Generating...' : '✨ AI'}</button>
          )}
        </div>
        <input
          type="text" value={finalName}
          onChange={(e) => handleNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !nameError && finalName) onConfirm(file, finalName);
            if (e.key === 'Escape') onCancel();
          }}
          autoFocus
          style={{
            width: '100%', padding: `${T.spacingSm} ${T.spacingMd}`,
            border: `1px solid ${nameError ? T.colorError : T.colorBorder}`,
            borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
            fontFamily: T.fontMono, outline: 'none', boxSizing: 'border-box',
            transition: `border-color ${T.transitionFast}`,
          }}
        />

        {aiSuggestions.length > 1 && (
          <div style={{ display: 'flex', gap: T.spacingSm, flexWrap: 'wrap', marginTop: T.spacingSm }}>
            {aiSuggestions.map((s) => (
              <button key={s} onClick={() => { setFinalName(s); setNameError(validate(s)); }} style={{
                background: finalName === s ? T.colorAccent : T.colorBgTertiary,
                color: finalName === s ? T.colorBg : T.colorTextSecondary,
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
          <button onClick={onCancel} style={{
            padding: `${T.spacingSm} ${T.spacingLg}`, background: 'none',
            border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
            fontSize: T.fontSizeSm, color: T.colorTextSecondary, cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={() => { if (!nameError && finalName) onConfirm(file, finalName); }}
            disabled={!!nameError || !finalName}
            style={{
              padding: `${T.spacingSm} ${T.spacingLg}`,
              background: nameError || !finalName ? T.colorBorder : T.colorAccent,
              color: nameError || !finalName ? T.colorTextMuted : T.colorBg,
              border: 'none', borderRadius: T.radiusSm,
              fontSize: T.fontSizeSm, fontWeight: 500,
              cursor: nameError || !finalName ? 'default' : 'pointer',
            }}
          >Upload</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AssetNameDialog;
