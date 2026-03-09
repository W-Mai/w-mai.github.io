import { useState, useEffect, useRef, useCallback, type FC } from 'react';

const GISCUS_ORIGIN = 'https://giscus.app';
const SESSION_KEY = 'giscus-session';

interface GiscusClientProps {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: 'url' | 'pathname' | 'title' | 'og:title' | 'specific' | 'number';
  theme: string;
  lang?: string;
  term?: string;
  reactionsEnabled?: boolean;
  emitMetadata?: boolean;
  inputPosition?: 'top' | 'bottom';
  loading?: 'lazy' | 'eager';
}

interface DiscussionMeta {
  totalCommentCount: number;
  totalReplyCount: number;
  reactionCount: number;
}

const GiscusClient: FC<GiscusClientProps> = ({
  repo, repoId, category, categoryId, mapping, theme,
  lang = 'zh-CN', term = '', reactionsEnabled = true,
  emitMetadata = true, inputPosition = 'bottom', loading = 'lazy',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [meta, setMeta] = useState<DiscussionMeta | null>(null);
  const [session, setSession] = useState('');

  // SSR guard
  useEffect(() => { setMounted(true); }, []);

  // Restore session from URL param or localStorage
  useEffect(() => {
    if (!mounted) return;
    const url = new URL(location.href);
    const paramSession = url.searchParams.get('giscus');
    if (paramSession) {
      setSession(paramSession);
      localStorage.setItem(SESSION_KEY, JSON.stringify(paramSession));
      url.searchParams.delete('giscus');
      history.replaceState(undefined, document.title, url.toString());
      return;
    }
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) setSession(JSON.parse(saved) || '');
    } catch { localStorage.removeItem(SESSION_KEY); }
  }, [mounted]);

  // Build iframe src
  const buildSrc = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const params: Record<string, string> = {
      origin: location.href,
      theme,
      reactionsEnabled: reactionsEnabled ? '1' : '0',
      emitMetadata: emitMetadata ? '1' : '0',
      inputPosition,
      repo,
      repoId,
      category,
      categoryId,
      lang,
      description: document.querySelector<HTMLMetaElement>(
        "meta[property='og:description'],meta[name='description']"
      )?.content || '',
    };

    if (session) params.session = session;

    switch (mapping) {
      case 'url': params.term = location.href; break;
      case 'title': params.term = document.title; break;
      case 'og:title':
        params.term = document.querySelector<HTMLMetaElement>(
          "meta[property='og:title']"
        )?.content || ''; break;
      case 'specific': params.term = term; break;
      case 'number': params.number = term; break;
      case 'pathname':
      default:
        params.term = location.pathname.length < 2
          ? 'index'
          : location.pathname.slice(1).replace(/\.\w+$/, '');
    }

    return `${GISCUS_ORIGIN}/widget?${new URLSearchParams(params)}`;
  }, [session, theme, reactionsEnabled, emitMetadata, inputPosition,
      repo, repoId, category, categoryId, lang, mapping, term]);

  // Listen for giscus postMessage events
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== GISCUS_ORIGIN) return;
      const data = e.data;
      if (typeof data !== 'object' || !data?.giscus) return;

      // Handle iframe resize
      if (data.giscus.resizeHeight && iframeRef.current) {
        iframeRef.current.style.height = `${data.giscus.resizeHeight}px`;
      }

      // Handle sign out
      if (data.giscus.signOut) {
        localStorage.removeItem(SESSION_KEY);
        setSession('');
        return;
      }

      // Handle error messages
      if (data.giscus.error) {
        const msg: string = data.giscus.error;
        if (msg.includes('Bad credentials') || msg.includes('Invalid state value')) {
          localStorage.removeItem(SESSION_KEY);
          setSession('');
        }
        return;
      }

      // Handle metadata
      if (data.giscus.discussion) {
        const d = data.giscus.discussion;
        setMeta({
          totalCommentCount: d.totalCommentCount ?? 0,
          totalReplyCount: d.totalReplyCount ?? 0,
          reactionCount: d.reactionCount ?? 0,
        });
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Neumorphism inline styles
  const neuBg = '#e0e5ec';

  if (!mounted) return null;

  const shadowDark = 'rgb(163 177 198 / 0.6)';
  const shadowLight = 'rgb(255 255 255 / 0.5)';
  const shadowDarkStrong = 'rgb(163 177 198 / 0.7)';
  const shadowLightStrong = 'rgb(255 255 255 / 0.8)';

  return (
    <div style={{
      marginTop: '3rem',
      fontFamily: '"ArkPixel", sans-serif',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <h3 style={{
          margin: 0, fontSize: '1.15rem', fontWeight: 700,
          color: '#334155',
        }}>
          💬 评论
        </h3>
        {meta && (
          <div style={{
            display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
          }}>
            {/* Comment count badge */}
            <div style={{
              background: neuBg, borderRadius: '12px', padding: '6px 14px',
              boxShadow: `3px 3px 6px ${shadowDark}, -3px -3px 6px ${shadowLight}`,
              fontSize: '0.8rem', color: '#64748b',
            }}>
              🗨 {meta.totalCommentCount + meta.totalReplyCount}
            </div>
            {/* Reaction badge — sticker + count, vertical layout */}
            <div style={{
              background: neuBg, borderRadius: '14px', padding: '8px 14px',
              boxShadow: `3px 3px 6px ${shadowDark}, -3px -3px 6px ${shadowLight}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            }}>
              <img
                src="/social/reaction-heart.jpg"
                alt="reaction"
                style={{ width: '28px', height: '28px', borderRadius: '4px' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                {meta.reactionCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Raised card container */}
      <div style={{
        background: neuBg,
        borderRadius: '1.5rem',
        boxShadow: `9px 9px 16px ${shadowDark}, -9px -9px 16px ${shadowLight}`,
        padding: '0.5rem',
        transition: 'box-shadow 0.3s ease',
        overflow: 'hidden',
        minHeight: loaded ? undefined : '200px',
        position: 'relative',
      }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94a3b8', fontSize: '0.85rem',
          }}>
            Loading comments...
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="giscus-frame"
          title="Comments"
          src={buildSrc()}
          loading={loading}
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%', border: 'none',
            height: '150px', colorScheme: 'light',
            borderRadius: '1rem',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease, height 0.2s ease',
          }}
        />
      </div>
    </div>
  );
};

export default GiscusClient;
