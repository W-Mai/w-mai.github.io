/**
 * Share card component — generates a shareable image combining
 * the OG image with a QR code pointing to the page URL.
 * Renders as a floating button; click to open the card modal.
 */

import { useState, useRef, useCallback, useEffect, type FC } from 'react';
import QRCode from 'qrcode';

interface ShareCardProps {
  ogUrl: string;
  pageUrl: string;
  title: string;
  avatarUrl?: string;
}

const CARD_W = 1200;
const QR_SIZE = 96;
const BAR_H = 140;
const CARD_H = 630 + BAR_H;
const PADDING = 64;
const RADIUS = 32;

async function generateCard(
  ogUrl: string,
  pageUrl: string,
  title: string,
  avatarUrl?: string,
): Promise<HTMLCanvasElement> {
  // Inner content canvas
  const inner = document.createElement('canvas');
  inner.width = CARD_W;
  inner.height = CARD_H;
  const ctx = inner.getContext('2d')!;

  // Load OG image (bust browser cache with timestamp)
  const ogImg = await loadImage(`${ogUrl}?t=${Date.now()}`);

  // Extract dominant color for themed shadow
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = ogImg.width;
  sampleCanvas.height = ogImg.height;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(ogImg, 0, 0);
  const sampleData = sCtx.getImageData(0, 0, ogImg.width, ogImg.height).data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < sampleData.length; i += 40 * 4) {
    rSum += sampleData[i];
    gSum += sampleData[i + 1];
    bSum += sampleData[i + 2];
    count++;
  }
  const avgR = Math.round(rSum / count);
  const avgG = Math.round(gSum / count);
  const avgB = Math.round(bSum / count);

  // Draw OG image
  ctx.drawImage(ogImg, 0, 0, CARD_W, 630);

  // Draw bottom bar
  ctx.fillStyle = '#1a1e23';
  ctx.fillRect(0, 630, CARD_W, BAR_H);

  // Draw QR code
  const qrDataUrl = await QRCode.toDataURL(pageUrl, {
    width: QR_SIZE * 2,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#1a1e23', light: '#ffffff' },
  });
  const qrImg = await loadImage(qrDataUrl);
  const qrX = CARD_W - QR_SIZE - 48;
  const qrY = 630 + (BAR_H - QR_SIZE) / 2;

  // White rounded rect behind QR
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 6, qrY - 6, QR_SIZE + 12, QR_SIZE + 12, 8);
  ctx.fill();
  ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);

  // Avatar in QR center
  if (avatarUrl) {
    try {
      const avatar = await loadImage(avatarUrl);
      const avatarSize = Math.round(QR_SIZE * 0.28);
      const ax = qrX + (QR_SIZE - avatarSize) / 2;
      const ay = qrY + (QR_SIZE - avatarSize) / 2;
      // White circle background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
      ctx.fill();
      // Clip avatar to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
      ctx.restore();
    } catch { /* avatar load failed — QR still works */ }
  }

  // Draw title text (truncated)
  ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
  const maxTextW = qrX - 80;
  const truncated = truncateText(ctx, title, maxTextW);
  ctx.fillText(truncated, 40, 630 + BAR_H / 2 - 8);

  // Draw "scan to read" hint
  ctx.fillStyle = 'rgba(241, 245, 249, 0.4)';
  ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('扫码阅读原文', 40, 630 + BAR_H / 2 + 22);

  // Compose onto outer canvas with rounded card + drop shadow on transparent bg
  const outerW = CARD_W + PADDING * 2;
  const outerH = CARD_H + PADDING * 2;
  const canvas = document.createElement('canvas');
  canvas.width = outerW;
  canvas.height = outerH;
  const oc = canvas.getContext('2d')!;

  // Drop shadow using OG dominant color
  oc.shadowColor = `rgba(${avgR}, ${avgG}, ${avgB}, 0.5)`;
  oc.shadowBlur = 32;
  oc.shadowOffsetX = 0;
  oc.shadowOffsetY = 8;
  oc.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
  roundRect(oc, PADDING, PADDING, CARD_W, CARD_H, RADIUS);
  oc.fill();

  // Reset shadow
  oc.shadowColor = 'transparent';
  oc.shadowBlur = 0;
  oc.shadowOffsetX = 0;
  oc.shadowOffsetY = 0;

  // Clip to rounded rect and draw inner content
  oc.save();
  roundRect(oc, PADDING, PADDING, CARD_W, CARD_H, RADIUS);
  oc.clip();
  oc.drawImage(inner, PADDING, PADDING);
  oc.restore();

  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const ShareCard: FC<ShareCardProps> = ({ ogUrl, pageUrl, title, avatarUrl }) => {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setOpen(false);
      setPreviewUrl('');
      setCopied(false);
      canvasRef.current = null;
    }, 200);
  }, []);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    setGenerating(true);
    try {
      const canvas = await generateCard(ogUrl, pageUrl, title, avatarUrl);
      canvasRef.current = canvas;
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error('[share] Failed to generate card:', e);
    } finally {
      setGenerating(false);
    }
  }, [ogUrl, pageUrl, title, avatarUrl]);

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject()), 'image/png'),
      );
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: download
      handleDownload();
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `share-${title.slice(0, 20).replace(/[^\w\u4e00-\u9fff]/g, '_')}.png`;
    a.click();
  }, [previewUrl, title]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const isOpen = open && !closing;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="neu-btn neu-link-btn gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-link)]"
        title="生成分享卡片"
      >
        <span>📤</span>
        <span>分享</span>
      </button>

      {/* Modal */}
      {(open || closing) && (
        <>
          <style>{`
            @keyframes shareOverlayIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes shareOverlayOut { from { opacity: 1 } to { opacity: 0 } }
            @keyframes sharePanelIn { from { opacity: 0; transform: scale(0.92) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
            @keyframes sharePanelOut { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.92) translateY(12px) } }
          `}</style>
          <div
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
            style={{
              background: 'var(--overlay-bg)',
              animation: `${isOpen ? 'shareOverlayIn' : 'shareOverlayOut'} 0.2s ease both`,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          >
            <div
              className="neu-card rounded-2xl max-w-lg w-full flex flex-col overflow-hidden"
              style={{
                animation: `${isOpen ? 'sharePanelIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' : 'sharePanelOut 0.2s ease'} both`,
              }}
            >
              {/* Preview */}
              <div className="p-4">
                {generating ? (
                  <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
                    生成中…
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Share card preview"
                    className="w-full rounded-xl"
                    style={{ boxShadow: 'inset 2px 2px 5px var(--neu-shadow-dark), inset -2px -2px 5px var(--neu-shadow-light)' }}
                  />
                ) : (
                  <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
                    生成失败
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-end gap-3 px-4 py-3 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <button
                  onClick={handleDownload}
                  disabled={!previewUrl}
                  className="neu-btn neu-link-btn gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-link)]"
                >
                  💾 下载
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!previewUrl}
                  className="neu-btn neu-link-btn gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--text-link)]"
                >
                  {copied ? '✅ 已复制' : '📋 复制图片'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ShareCard;
