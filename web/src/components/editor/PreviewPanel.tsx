import html2canvas from 'html2canvas';
import { useEffect, useRef, useState, type FC } from 'react';

interface PreviewPanelProps {
  slug: string | null;
  refreshKey: number;
  scrollRatio: number;
}

/** Get current scroll ratio (0–1) from an iframe */
function getScrollRatio(iframe: HTMLIFrameElement): number {
  try {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (win && doc) {
      const max = doc.documentElement.scrollHeight - win.innerHeight;
      return max > 0 ? win.scrollY / max : 0;
    }
  } catch {}
  return 0;
}

/**
 * Capture the visible viewport of a same-origin iframe as a data URL.
 * Only captures the currently visible portion for speed.
 */
async function captureIframe(iframe: HTMLIFrameElement): Promise<string | null> {
  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc?.documentElement || !win) return null;

    const w = iframe.clientWidth;
    const h = iframe.clientHeight;
    if (w === 0 || h === 0) return null;

    const canvas = await html2canvas(doc.documentElement, {
      x: 0,
      y: win.scrollY,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      logging: false,
      scale: 1,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

const PreviewPanel: FC<PreviewPanelProps> = ({ slug, refreshKey, scrollRatio }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevRefreshKey = useRef(refreshKey);
  const prevSlug = useRef(slug);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const pendingUrl = useRef<string | null>(null);

  // Trigger reload: capture screenshot first, then queue new src
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !slug) return;

    const isRefresh = refreshKey !== prevRefreshKey.current;
    const isSlugChange = slug !== prevSlug.current;
    prevRefreshKey.current = refreshKey;
    prevSlug.current = slug;

    if (isRefresh && !isSlugChange) {
      const ratio = getScrollRatio(iframe);
      const hash = ratio > 0 ? `#sr=${ratio.toFixed(4)}` : '';
      const url = `/blog/${slug}?embed&t=${refreshKey}${hash}`;

      captureIframe(iframe).then((dataUrl) => {
        if (dataUrl) {
          pendingUrl.current = url;
          setSnapshot(dataUrl);
        } else {
          iframe.src = url;
        }
      });
    } else {
      iframe.src = `/blog/${slug}?embed&t=${refreshKey}`;
    }
  }, [slug, refreshKey]);

  // Once snapshot overlay is rendered, set the iframe src
  useEffect(() => {
    if (snapshot && pendingUrl.current) {
      const url = pendingUrl.current;
      pendingUrl.current = null;
      // Wait for next paint so overlay is visible before iframe starts loading
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (iframeRef.current) iframeRef.current.src = url;
        });
      });
    }
  }, [snapshot]);

  const scrollRatioRef = useRef(scrollRatio);
  scrollRatioRef.current = scrollRatio;

  // Clear snapshot when iframe signals ready; sync scroll on load
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'embed:ready') setSnapshot(null);
    };
    window.addEventListener('message', handleMessage);

    const iframe = iframeRef.current;
    const handleLoad = () => {
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) return;
        const max = doc.documentElement.scrollHeight - win.innerHeight;
        // Always sync scroll position with editor, even if ratio is 0
        win.scrollTo({ top: max > 0 ? scrollRatioRef.current * max : 0 });
      } catch {}
    };
    iframe?.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe?.removeEventListener('load', handleLoad);
    };
  }, []);

  // Sync scroll from editor cursor position
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !slug) return;
    try {
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) return;
      const max = doc.documentElement.scrollHeight - win.innerHeight;
      if (max > 0) win.scrollTo({ top: scrollRatio * max });
    } catch {}
  }, [scrollRatio, slug]);

  if (!slug) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9ca3af', fontSize: '0.9rem', fontFamily: 'sans-serif',
      }}>
        Select a post to preview
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '0.375rem 0.75rem', background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        fontSize: '0.75rem', color: '#9ca3af',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <span>/blog/{slug}</span>
        <div style={{ flex: 1 }} />
        {snapshot && (
          <span style={{ fontSize: '0.7rem', color: '#d1d5db' }}>refreshing…</span>
        )}
        <button
          onClick={() => {
            const iframe = iframeRef.current;
            if (!iframe || !slug) return;
            const ratio = getScrollRatio(iframe);
            const hash = ratio > 0 ? `#sr=${ratio.toFixed(4)}` : '';
            const url = `/blog/${slug}?embed&t=${Date.now()}${hash}`;
            captureIframe(iframe).then((dataUrl) => {
              if (dataUrl) {
                pendingUrl.current = url;
                setSnapshot(dataUrl);
              } else {
                iframe.src = url;
              }
            });
          }}
          style={{
            background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.25rem',
            padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem', color: '#6b7280',
          }}
        >
          ↻ Refresh
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          title="Blog Preview"
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
        />
        {/* Screenshot overlay to prevent flash during reload */}
        {snapshot && (
          <img
            src={snapshot}
            alt=""
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top left',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
