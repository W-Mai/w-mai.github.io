import { useState, useMemo, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';

interface PostInfo {
  slug: string;
  title: string;
}

interface PostListProps {
  posts: PostInfo[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onDelete: (slug: string) => void;
}

const PostList: FC<PostListProps> = ({ posts, selectedSlug, onSelect, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showTitle, setShowTitle] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm) return posts;
    const lower = searchTerm.toLowerCase();
    return posts.filter((p) =>
      p.slug.toLowerCase().includes(lower) || p.title.toLowerCase().includes(lower)
    );
  }, [posts, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search + toggle */}
      <div style={{ padding: `${T.spacingSm} ${T.spacingMd}`, borderBottom: `1px solid ${T.colorBorderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingXs }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter posts..."
            style={{
              flex: 1, padding: `${T.spacingXs} ${T.spacingSm}`,
              border: `1px solid ${T.colorBorder}`, borderRadius: T.radiusSm,
              fontSize: T.fontSizeXs, outline: 'none', boxSizing: 'border-box',
              fontFamily: T.fontSans, color: T.colorText,
              transition: `border-color ${T.transitionFast}`,
            }}
          />
          <button
            onClick={() => setShowTitle((v) => !v)}
            title={showTitle ? 'Show filenames' : 'Show titles'}
            style={{
              background: 'none', border: `1px solid ${T.colorBorder}`,
              borderRadius: T.radiusSm, padding: `${T.spacingXs} 0.35rem`,
              fontSize: T.fontSizeXs, cursor: 'pointer',
              color: T.colorTextSecondary, lineHeight: 1,
              transition: `all ${T.transitionFast}`,
            }}
          >
            {showTitle ? 'Aa' : '📄'}
          </button>
        </div>
        {searchTerm && (
          <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginTop: T.spacingXs }}>
            {filtered.length} / {posts.length}
          </div>
        )}
      </div>

      {/* Post list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {posts.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeBase }}>
            No posts found.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeSm }}>
            No matching posts
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filtered.map((post) => {
              const label = showTitle ? (post.title || post.slug) : post.slug;
              return (
                <li key={post.slug} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => onSelect(post.slug)}
                    title={showTitle ? post.slug : post.title}
                    style={{
                      flex: 1, padding: `0.625rem ${T.spacingXl}`,
                      border: 'none',
                      background: post.slug === selectedSlug ? T.colorBgTertiary : 'transparent',
                      color: post.slug === selectedSlug ? T.colorText : T.colorTextSecondary,
                      fontWeight: post.slug === selectedSlug ? 600 : 400,
                      fontSize: T.fontSizeBase, textAlign: 'left', cursor: 'pointer',
                      borderLeft: post.slug === selectedSlug ? `2px solid ${T.colorAccent}` : '2px solid transparent',
                      transition: `all ${T.transitionFast}`,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(post.slug); }}
                    title={`Delete ${post.slug}`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#d1d5db', fontSize: T.fontSizeSm, padding: '0.4rem',
                      marginRight: T.spacingXs, borderRadius: T.radiusSm,
                      transition: `color ${T.transitionFast}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.colorError; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PostList;
