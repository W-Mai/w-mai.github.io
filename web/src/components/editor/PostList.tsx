import type { FC } from 'react';

interface PostListProps {
  posts: string[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onDelete: (slug: string) => void;
}

const PostList: FC<PostListProps> = ({ posts, selectedSlug, onSelect, onDelete }) => {
  if (posts.length === 0) {
    return (
      <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>
        No posts found.
      </div>
    );
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {posts.map((slug) => (
        <li key={slug} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => onSelect(slug)}
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              border: 'none',
              background: slug === selectedSlug ? '#f3f4f6' : 'transparent',
              color: slug === selectedSlug ? '#111827' : '#6b7280',
              fontWeight: slug === selectedSlug ? 600 : 400,
              fontSize: '0.875rem',
              textAlign: 'left',
              cursor: 'pointer',
              borderLeft: slug === selectedSlug ? '2px solid #111827' : '2px solid transparent',
              transition: 'all 0.15s',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {slug}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(slug); }}
            title={`Delete ${slug}`}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#d1d5db', fontSize: '0.75rem', padding: '0.4rem',
              marginRight: '0.25rem', borderRadius: '0.25rem',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; }}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
};

export default PostList;
