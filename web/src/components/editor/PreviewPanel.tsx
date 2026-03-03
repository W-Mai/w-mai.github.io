import { useEffect, useRef, type FC } from 'react';

interface PreviewPanelProps {
  slug: string | null;
  refreshKey: number;
  scrollRatio: number;
}

const PreviewPanel: FC<PreviewPanelProps> = ({ slug, refreshKey, scrollRatio }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;
    if (slug) {
      // Load the actual blog page rendered by Astro dev server
      iframeRef.current.src = `/blog/${slug}?t=${refreshKey}`;
    }
  }, [slug, refreshKey]);

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
    } catch {
      // Cross-origin or not loaded yet — ignore
    }
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
