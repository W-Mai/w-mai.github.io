import { useEffect, useRef, type FC } from 'react';

interface PreviewPanelProps {
  slug: string | null;
  refreshKey: number;
  scrollRatio: number;
}

const PreviewPanel: FC<PreviewPanelProps> = ({ slug, refreshKey, scrollRatio }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const savedScrollTop = useRef<number | null>(null);
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !slug) return;

    // Save scroll position before reload (only on refreshKey change, not slug change)
    if (refreshKey !== prevRefreshKey.current) {
      try {
        savedScrollTop.current = iframe.contentWindow?.scrollY ?? null;
      } catch {
        savedScrollTop.current = null;
      }
      prevRefreshKey.current = refreshKey;
    } else {
      savedScrollTop.current = null;
    }

    iframe.src = `/blog/${slug}?t=${refreshKey}`;
  }, [slug, refreshKey]);

  // Inject embed styles to hide header/footer in preview iframe
  const injectEmbedStyles = (iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const id = 'editor-embed-style';
      if (doc.getElementById(id)) return;
      const style = doc.createElement('style');
      style.id = id;
      style.textContent = `
        body > header, body > footer,
        #progress-bar,
        main > a[href="/blog"],
        main > div:last-child { display: none !important; }
        main { padding-top: 1rem !important; }
      `;
      doc.head.appendChild(style);
    } catch {}
  };

  // Restore scroll position after iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      injectEmbedStyles(iframe);
      if (savedScrollTop.current !== null) {
        try {
          iframe.contentWindow?.scrollTo(0, savedScrollTop.current);
        } catch {}
        savedScrollTop.current = null;
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  // Sync scroll position from editor
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !slug) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const { scrollHeight, clientHeight } = doc.documentElement;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll > 0) {
        iframe.contentWindow?.scrollTo({ top: scrollRatio * maxScroll });
      }
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
        <button
          onClick={() => {
            if (iframeRef.current && slug) {
              try { savedScrollTop.current = iframeRef.current.contentWindow?.scrollY ?? null; } catch {}
              iframeRef.current.src = `/blog/${slug}?t=${Date.now()}`;
            }
          }}
          style={{
            background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.25rem',
            padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem', color: '#6b7280',
          }}
        >
          ↻ Refresh
        </button>
      </div>
      <iframe
        ref={iframeRef}
        title="Blog Preview"
        style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
      />
    </div>
  );
};

export default PreviewPanel;
