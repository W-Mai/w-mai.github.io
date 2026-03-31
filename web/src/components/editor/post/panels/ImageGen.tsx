/**
 * ImageGenPanel — AI image generation panel for blog editor.
 * Two modes: hero (cover image from full article) and inline (from selected text).
 */

import { useState, useCallback, type FC } from 'react';
import { EDITOR_TOKENS as T } from '~/components/editor/shared/editor-tokens';

const STYLES = [
  { id: 'flat', emoji: '🎨', label: '扁平插画' },
  { id: 'isometric', emoji: '🧊', label: '等距2.5D' },
  { id: 'gradient', emoji: '🌈', label: '渐变抽象' },
  { id: 'line', emoji: '✏️', label: '线条艺术' },
  { id: 'soft3d', emoji: '💎', label: '柔和3D' },
  { id: 'pixel', emoji: '👾', label: '像素风' },
  { id: 'paper', emoji: '📄', label: '纸片叠层' },
  { id: 'lowpoly', emoji: '🔺', label: '低多边形' },
] as const;

type StyleId = typeof STYLES[number]['id'];

export interface ImageGenPanelProps {
  mode: 'hero' | 'inline';
  slug: string;
  /** Full article content (hero mode) or selected text (inline mode) */
  content: string;
  title?: string;
  description?: string;
  category?: string;
  onDone: (result: { path: string; filename: string }) => void;
  onClose: () => void;
}

const ImageGenPanel: FC<ImageGenPanelProps> = ({
  mode, slug, content, title, description, category, onDone, onClose,
}) => {
  const [style, setStyle] = useState<StyleId>('gradient');
  const [prompt, setPrompt] = useState('');
  const [filename, setFilename] = useState(mode === 'hero' ? 'cover.jpg' : '');
  const [previewUrl, setPreviewUrl] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Generate prompt from content + style
  const handleGenPrompt = useCallback(async () => {
    setPromptLoading(true);
    setError('');
    try {
      // Fetch article content for hero mode
      let articleContent = content;
      if (mode === 'hero' && !articleContent) {
        const postRes = await fetch(`/api/editor/posts/${slug}`);
        if (postRes.ok) articleContent = await postRes.text();
      }

      const res = await fetch('/api/editor/ai/generate-hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prompt',
          slug, title, description, category,
          content: mode === 'hero' ? articleContent : undefined,
          selectedText: mode === 'inline' ? content : undefined,
          style,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPrompt(data.prompt || '');
      if (mode === 'inline' && data.filename) setFilename(data.filename);
    } catch (e: any) { setError(e.message); }
    finally { setPromptLoading(false); }
  }, [slug, title, description, category, content, mode, style]);

  // Step 2: Generate image from prompt
  const handleGenImage = useCallback(async () => {
    if (!prompt) return;
    setImageLoading(true);
    setError('');
    try {
      const res = await fetch('/api/editor/ai/generate-hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'image',
          slug, prompt, filename,
          size: mode === 'hero' ? '3360x1120' : '2048x2048',
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPreviewUrl(`/api/editor/posts/${slug}/images/${encodeURIComponent(data.filename)}?t=${Date.now()}`);
      onDone({ path: data.path, filename: data.filename });
    } catch (e: any) { setError(e.message); }
    finally { setImageLoading(false); }
  }, [slug, prompt, filename, mode, onDone]);

  const isLoading = promptLoading || imageLoading;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: T.spacingMd,
      padding: T.spacingLg, fontFamily: T.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: T.fontSizeMd, color: T.colorText }}>
          {mode === 'hero' ? '🎨 生成题图' : '🖼️ 生成插图'}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: T.fontSizeMd, color: T.colorTextMuted,
        }}>✕</button>
      </div>

      {/* Content display */}
      <div style={{
        padding: `${T.spacingXs} ${T.spacingSm}`,
        background: T.colorBg,
        borderRadius: T.radiusSm,
        fontSize: T.fontSizeSm,
        color: T.colorTextMuted,
        boxShadow: T.shadowInset,
        maxHeight: '60px', overflow: 'hidden',
      }}>
        {mode === 'hero' ? (
          <span style={{ fontStyle: 'italic' }}>📄 全文内容</span>
        ) : (
          <span>{content.slice(0, 200)}{content.length > 200 ? '…' : ''}</span>
        )}
      </div>

      {/* Style selector */}
      <div>
        <label style={{ fontSize: T.fontSizeXs, color: T.colorTextSecondary, fontWeight: 600, marginBottom: '4px', display: 'block' }}>
          风格
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingMd }}>
          <div className="neu-mood-capsule" style={{ flexWrap: 'wrap', flexShrink: 0 }}>
            {STYLES.map(s => (
              <button
                key={s.id}
                className={`neu-mood-item${style === s.id ? ' selected' : ''}`}
                onClick={() => setStyle(s.id)}
                title={s.label}
              >
                {s.emoji}
              </button>
            ))}
          </div>
          <span style={{ fontSize: T.fontSizeSm, color: T.colorTextSecondary, whiteSpace: 'nowrap' }}>
            {STYLES.find(s => s.id === style)?.label}
          </span>
        </div>
      </div>

      {/* Generate prompt button */}
      <button
        onClick={handleGenPrompt}
        disabled={isLoading}
        style={{
          padding: `${T.spacingSm} ${T.spacingMd}`,
          background: T.colorBg, border: `1px solid ${T.colorBorderLight}`,
          borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
          fontFamily: T.fontSans, color: T.colorText,
          cursor: isLoading ? 'wait' : 'pointer', boxShadow: T.shadowBtn,
        }}
      >
        {promptLoading ? '✨ 生成提示词中…' : '✨ 第一步：生成提示词'}
      </button>

      {/* Prompt editor */}
      {prompt && (
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: T.spacingSm, background: T.colorBg,
            border: `1px solid ${T.colorBorderLight}`,
            borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
            fontFamily: T.fontSans, color: T.colorText,
            boxShadow: T.shadowInset, resize: 'vertical',
          }}
        />
      )}

      {/* Filename */}
      {prompt && (
        <div>
          <label style={{ fontSize: T.fontSizeXs, color: T.colorTextSecondary, fontWeight: 600, marginBottom: '4px', display: 'block' }}>
            文件名
          </label>
          {mode === 'hero' ? (
            <span style={{ fontSize: T.fontSizeSm, color: T.colorTextMuted }}>{filename}</span>
          ) : (
            <input
              value={filename}
              onChange={e => setFilename(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: `${T.spacingXs} ${T.spacingSm}`,
                background: T.colorBg, border: `1px solid ${T.colorBorderLight}`,
                borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
                fontFamily: T.fontMono, color: T.colorText,
                boxShadow: T.shadowInset,
              }}
            />
          )}
        </div>
      )}

      {/* Generate image button */}
      {prompt && (
        <button
          onClick={handleGenImage}
          disabled={isLoading || !prompt}
          style={{
            padding: `${T.spacingSm} ${T.spacingMd}`,
            background: T.colorBg, border: `1px solid ${T.colorBorderLight}`,
            borderRadius: T.radiusSm, fontSize: T.fontSizeSm,
            fontFamily: T.fontSans, color: T.colorText,
            cursor: isLoading ? 'wait' : 'pointer', boxShadow: T.shadowBtn,
          }}
        >
          {imageLoading ? '🎨 生成图片中…' : '🎨 第二步：生成图片'}
        </button>
      )}

      {/* Preview */}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Generated preview"
          style={{ width: '100%', borderRadius: T.radiusSm, boxShadow: T.shadowInset }}
        />
      )}

      {/* Error */}
      {error && (
        <div style={{ fontSize: T.fontSizeSm, color: T.colorError, padding: T.spacingXs }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageGenPanel;
