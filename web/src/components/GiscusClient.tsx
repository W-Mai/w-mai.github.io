import { useState, useEffect, useRef, useCallback, type FC } from 'react';

const GISCUS_ORIGIN = 'https://giscus.app';
const SESSION_KEY = 'giscus-session';
const GH_API = 'https://api.github.com';

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

interface Reactor {
  login: string;
  avatarUrl: string;
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
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [pressed, setPressed] = useState(false);

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

  // Fetch reactor avatars from GitHub Discussions search API
  useEffect(() => {
    if (!mounted) return;
    const searchTerm = location.pathname.length < 2
      ? 'index'
      : location.pathname.slice(1).replace(/\.\w+$/, '');

    fetch(`${GH_API}/search/discussions?q=${encodeURIComponent(searchTerm)}+repo:${repo}`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.items?.length) return;
        const disc = data.items[0];
        // Fetch reactions for this discussion
        return fetch(`${GH_API}/repos/${repo}/discussions/${disc.number}/reactions`, {
          headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
        });
      })
      .then(r => r?.ok ? r.json() : null)
      .then(reactions => {
        if (!Array.isArray(reactions)) return;
        const seen = new Set<string>();
        const users: Reactor[] = [];
        for (const r of reactions) {
          if (r.user && !seen.has(r.user.login)) {
            seen.add(r.user.login);
            users.push({ login: r.user.login, avatarUrl: r.user.avatar_url });
          }
        }
        setReactors(users);
      })
      .catch(() => {});
  }, [mounted, repo]);

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

      if (data.giscus.resizeHeight && iframeRef.current) {
        iframeRef.current.style.height = `${data.giscus.resizeHeight}px`;
      }

      if (data.giscus.signOut) {
        localStorage.removeItem(SESSION_KEY);
        setSession('');
        return;
      }

      if (data.giscus.error) {
        const msg: string = data.giscus.error;
        if (msg.includes('Bad credentials') || msg.includes('Invalid state value')) {
          localStorage.removeItem(SESSION_KEY);
          setSession('');
        }
        return;
      }

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

  // Click handler — highlight reaction area in iframe
  const handleReactionClick = useCallback(() => {
    setPressed(true);
    setTimeout(() => setPressed(false), 300);

    // Switch to highlight theme via postMessage
    const highlightTheme = theme.replace('.css', '-highlight.css');
    iframeRef.current?.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: highlightTheme } } },
      GISCUS_ORIGIN,
    );

    // Revert to normal theme after animation completes
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { giscus: { setConfig: { theme } } },
        GISCUS_ORIGIN,
      );
    }, 2500);
  }, [theme]);

  const neuBg = '#e0e5ec';

  if (!mounted) return null;

  const sd = 'rgb(163 177 198 / 0.6)';
  const sl = 'rgb(255 255 255 / 0.5)';

  return (
    <div style={{
      marginTop: '3rem',
      fontFamily: '"ArkPixel", sans-serif',
    }}>
      {/* Centered reaction hero — always visible */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        marginBottom: '1.5rem', gap: '0.4rem',
      }}>
        <button
          type="button"
          onClick={handleReactionClick}
          aria-label="Scroll to reactions"
          style={{
            background: neuBg, borderRadius: '50%', padding: '8px',
            boxShadow: pressed
              ? `inset 4px 4px 8px ${sd}, inset -4px -4px 8px ${sl}`
              : `6px 6px 12px ${sd}, -6px -6px 12px ${sl}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            transform: pressed ? 'scale(0.92)' : 'scale(1)',
            border: 'none', cursor: 'pointer',
          }}
        >
          <img
            src="/social/reaction-heart.jpg"
            alt="reaction"
            style={{ width: '64px', height: '64px', borderRadius: '50%', display: 'block' }}
          />
        </button>
        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#334155' }}>
          {meta?.reactionCount ?? 0}
        </span>

        {/* Reactor avatars */}
        {reactors.length > 0 && (
          <div style={{
            display: 'flex', gap: '0', marginTop: '0.25rem',
          }}>
            {reactors.slice(0, 8).map((r, i) => (
              <a
                key={r.login}
                href={`https://github.com/${r.login}`}
                target="_blank"
                rel="noopener noreferrer"
                title={r.login}
                style={{
                  marginLeft: i === 0 ? 0 : '-6px',
                  zIndex: reactors.length - i,
                }}
              >
                <img
                  src={`${r.avatarUrl}&s=40`}
                  alt={r.login}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: `2px solid ${neuBg}`,
                    boxShadow: `2px 2px 4px ${sd}, -2px -2px 4px ${sl}`,
                  }}
                />
              </a>
            ))}
            {reactors.length > 8 && (
              <span style={{
                marginLeft: '-6px', width: '28px', height: '28px',
                borderRadius: '50%', background: neuBg,
                border: `2px solid ${neuBg}`,
                boxShadow: `2px 2px 4px ${sd}, -2px -2px 4px ${sl}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', color: '#64748b', fontWeight: 600,
              }}>
                +{reactors.length - 8}
              </span>
            )}
          </div>
        )}

        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          真诚点赞，手留余香
        </span>
      </div>

      {/* Comment section title */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#334155' }}>
          💬 评论
        </h3>
        <div style={{
          background: neuBg, borderRadius: '12px', padding: '6px 14px',
          boxShadow: `3px 3px 6px ${sd}, -3px -3px 6px ${sl}`,
          fontSize: '0.8rem', color: '#64748b',
        }}>
          🗨 {meta ? meta.totalCommentCount + meta.totalReplyCount : 0}
        </div>
      </div>

      {/* Raised card container */}
      <div style={{
        background: neuBg,
        borderRadius: '1.5rem',
        boxShadow: `9px 9px 16px ${sd}, -9px -9px 16px ${sl}`,
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
