/**
 * Search dialog component for blog full-text search.
 * Renders a modal overlay with search input, result list,
 * keyboard navigation, and neumorphism styling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '~/lib/search/engine';
import { highlightMatches } from '~/lib/search/highlight';

export interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

const MAX_QUERY_LENGTH = 100;

// Singleton cache for search engine instance
type CachedEngine = { search: (query: string) => SearchResult[] };
let cachedEngine: CachedEngine | null = null;
let loadPromise: Promise<CachedEngine> | null = null;

/** Lazy-load search index and initialize MiniSearch engine (singleton) */
function loadSearchEngine(): Promise<CachedEngine> {
  if (cachedEngine) return Promise.resolve(cachedEngine);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [indexRes, engineMod] = await Promise.all([
      fetch('/search-index.json'),
      import('~/lib/search/engine'),
    ]);
    if (!indexRes.ok) throw new Error('Failed to load search index');
    const entries = await indexRes.json();
    const engine = engineMod.createSearchEngine(entries);
    cachedEngine = {
      search: (query: string) => engineMod.search(engine, query),
    };
    return cachedEngine;
  })();

  loadPromise.catch(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  // Animated close handler
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setQuery('');
      setResults([]);
      setActiveIndex(-1);
      onClose();
    }, 200);
  }, [onClose]);

  // Load engine on first open
  useEffect(() => {
    if (!open) return;
    if (cachedEngine) return;
    setLoading(true);
    loadSearchEngine()
      .then(() => setLoading(false))
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [open]);

  // Auto-focus input on open
  useEffect(() => {
    if (open && !closing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, closing]);

  // Search on query change
  useEffect(() => {
    if (!cachedEngine || !query.trim()) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    try {
      const res = cachedEngine.search(query);
      setResults(res);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    }
  }, [query]);

  // Focus trap
  useEffect(() => {
    if (!open || closing) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'input, a[href], button, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open, closing]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      handleClose();
      if (result.type === 'thought') {
        const anchorId = `thought-${result.slug}`;
        const onThoughtsPage = window.location.pathname.replace(/\/$/, '') === '/thoughts';
        if (onThoughtsPage) {
          // Already on thoughts page — dispatch custom event to trigger load-all + scroll
          window.dispatchEvent(
            new CustomEvent('search:scroll-to-thought', { detail: { anchorId } })
          );
          return;
        }
        // Cross-page: navigate with hash, thoughts page will handle it on load
        window.location.assign(`/thoughts/#${anchorId}`);
      } else if (result.type === 'friend') {
        window.location.assign(`/friends/#friend-${result.slug}`);
      } else if (result.type === 'wish') {
        window.location.assign(`/wishes/#wish-${result.slug}`);
      } else {
        window.location.assign(`/blog/${result.slug}`);
      }
    },
    [handleClose]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value.slice(0, MAX_QUERY_LENGTH));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault();
      navigateToResult(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open && !closing) return null;

  const isOpen = open && !closing;

  return (
    <>
      <style>{`
        .search-panel *:focus,
        .search-panel *:focus-visible {
          outline: none !important;
          border-color: transparent !important;
          -webkit-tap-highlight-color: transparent;
        }
        @keyframes searchOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes searchOverlayOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes searchPanelIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes searchPanelOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.92) translateY(12px); }
        }
        .search-overlay {
          animation: ${isOpen ? 'searchOverlayIn' : 'searchOverlayOut'} 0.2s ease both;
        }
        .search-panel {
          animation: ${isOpen ? 'searchPanelIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'searchPanelOut 0.2s ease'} both;
        }
        .search-result-item {
          transition: background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
        }
        .search-result-item:hover {
          background: linear-gradient(145deg, var(--neu-gradient-light), var(--neu-gradient-dark));
          transform: translateY(-1px);
        }
        .search-result-item.active {
          background: linear-gradient(145deg, var(--neu-gradient-dark), var(--neu-gradient-light));
          box-shadow: inset 2px 2px 4px var(--neu-shadow-dark-strong),
                      inset -2px -2px 4px var(--neu-shadow-light-strong);
          transform: translateY(0);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="search-overlay fixed inset-0 z-[2000] flex items-start justify-center pt-[15vh]"
        style={{ background: 'var(--overlay-bg)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        {/* Dialog */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          className="search-panel neu-card rounded-2xl mx-4 w-full max-w-lg flex flex-col overflow-hidden outline-none"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="p-4 pb-0">
            <div className="neu-inset rounded-xl flex items-center gap-2 p-3 outline-none">
              <svg
                className="w-4 h-4 flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                placeholder="搜索..."
                aria-label="全站搜索"
                aria-controls="search-results"
                aria-activedescendant={
                  activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
                }
                className="flex-1 min-w-0 text-sm bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="flex-shrink-0 p-0.5 rounded-md"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="清除搜索"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Results area */}
          <div className="p-4 overflow-y-auto max-h-[50vh]">
            {loading && (
              <p
                className="text-center text-sm py-6"
                style={{ color: 'var(--text-muted)' }}
              >
                加载搜索索引...
              </p>
            )}

            {error && (
              <p
                className="text-center text-sm py-6"
                style={{ color: 'var(--text-muted)' }}
              >
                搜索暂不可用
              </p>
            )}

            {!loading && !error && query.trim() && results.length === 0 && (
              <p
                className="text-center text-sm py-6"
                style={{ color: 'var(--text-muted)' }}
              >
                未找到相关内容
              </p>
            )}

            {results.length > 0 && (
              <div
                ref={listRef}
                id="search-results"
                role="listbox"
                className="flex flex-col gap-1"
              >
                {results.map((result, i) => (
                  <a
                    key={result.id}
                    id={`search-result-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    href={
                      result.type === 'thought' ? `/thoughts/#thought-${result.slug}`
                      : result.type === 'friend' ? `/friends/#friend-${result.slug}`
                      : result.type === 'wish' ? `/wishes/#wish-${result.slug}`
                      : `/blog/${result.slug}`
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToResult(result);
                    }}
                    className={`search-result-item block p-3 rounded-xl no-underline cursor-pointer ${
                      i === activeIndex ? 'active' : ''
                    }`}
                  >
                    <div
                      className="flex items-center gap-1.5 text-sm font-medium mb-0.5"
                      style={{ color: 'var(--text-heading)' }}
                    >
                      <span className="flex-shrink-0 text-xs">
                        {result.type === 'thought' ? '🧠' : result.type === 'friend' ? '🤝' : result.type === 'wish' ? '✨' : '✍️'}
                      </span>
                      <span className="min-w-0">
                        <HighlightedText text={result.title} query={query} />
                      </span>
                    </div>
                    {result.description && result.type !== 'thought' && (
                      <div
                        className="text-xs leading-relaxed line-clamp-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <HighlightedText
                          text={result.description}
                          query={query}
                        />
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Shortcut hints footer */}
          <div
            className="flex items-center gap-3 px-4 py-2 text-xs border-t"
            style={{
              color: 'var(--text-muted)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <span>
              <kbd className="neu-kbd">↑↓</kbd> 导航
            </span>
            <span>
              <kbd className="neu-kbd">Enter</kbd> 打开
            </span>
            <span>
              <kbd className="neu-kbd">Esc</kbd> 关闭
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/** Render highlighted text segments using <mark> tags */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = highlightMatches(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <mark
            key={i}
            className="bg-transparent font-semibold"
            style={{ color: 'var(--text-link-hover)' }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
