import { useEffect, useRef, type FC } from 'react';

interface PreviewPanelProps {
  slug: string | null;
  refreshKey: number;
  scrollRatio: number;
}

const PreviewPanel: FC<PreviewPanelProps> = ({ slug, refreshKey, scrollRatio }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const savedRatio = useRef<number | null>(null);
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !slug) return;

    // Save scroll ratio before reload (only on refreshKey change, not slug change)
    if (refreshKey !== prevRefreshKey.current) {
      try {
        const win = iframe.contentWindow;
        const doc = iframe.contentDocument;
        if (win && doc) {
          const maxScroll = doc.documentElement.scrollHeight - win.innerHeight;
          savedRatio.current = maxScroll > 0 ? win.scrollY / maxScroll : 0;
        }
      } catch {
        savedRatio.current = null;
      }
      prevRefreshKey.current = refreshKey;
    } else {
      savedRatio.current = null;
    }

    iframe.src = `/blog/${slug}?embed&t=${refreshKey}`;
  }, [slug, refreshKey]);

  // Restore scroll position after iframe loads using ratio + ResizeObserver
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const ratio = savedRatio.current;
      if (ratio === null || ratio <= 0) return;

      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) return;

        const applyScroll = () => {
          const maxScroll = doc.documentElement.scrollHeight - win.innerHeight;
          if (maxScroll > 0) {
            win.scrollTo(0, ratio * maxScroll);
          }
        };

        // Apply immediately
        applyScroll();

        // Re-apply on layout shifts as content loads (images, fonts, etc.)
        const observer = new ResizeObserver(applyScroll);
        observer.observe(doc.body);

        // Stop observing after content stabilizes
        setTimeout(() => observer.disconnect(), 3000);
      } catch {}
      savedRatio.current = null;
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
              try {
                const win = iframeRef.current.contentWindow;
                const doc = iframeRef.current.contentDocument;
                if (win && doc) {
                  const maxScroll = doc.documentElement.scrollHeight - win.innerHeight;
                  savedRatio.current = maxScroll > 0 ? win.scrollY / maxScroll : 0;
                }
              } catch {}
              iframeRef.current.src = `/blog/${slug}?embed&t=${Date.now()}`;
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
