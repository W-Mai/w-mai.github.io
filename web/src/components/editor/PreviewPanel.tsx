import { useEffect, useRef, useState, type FC } from 'react';

interface PreviewPanelProps {
  mdxContent: string;
}

const PreviewPanel: FC<PreviewPanelProps> = ({ mdxContent }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!mdxContent.trim()) {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = '<html><body style="color:#9ca3af;font-family:sans-serif;padding:2rem;">Start typing to see preview...</body></html>';
      }
      return;
    }

    // 500ms debounce
    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/editor/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: mdxContent,
        });
        const html = await res.text();
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
        if (!res.ok) {
          setError('Preview rendering failed');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch preview');
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mdxContent]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px', background: '#d1d5db', zIndex: 10,
        }}>
          <div style={{
            height: '100%', width: '30%', background: '#6b7280',
            animation: 'preview-loading 1s ease-in-out infinite',
          }} />
        </div>
      )}
      {error && (
        <div style={{
          padding: '0.5rem 1rem', background: '#fef2f2',
          color: '#dc2626', fontSize: '0.8rem', borderBottom: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="MDX Preview"
        sandbox="allow-scripts"
        style={{
          flex: 1, border: 'none', width: '100%',
          background: '#fff',
        }}
        srcDoc='<html><body style="color:#9ca3af;font-family:sans-serif;padding:2rem;">Select a post to preview...</body></html>'
      />
      <style>{`
        @keyframes preview-loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

export default PreviewPanel;
