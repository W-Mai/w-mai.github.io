import type { FC } from 'react';

interface PostListProps {
  posts: string[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

const PostList: FC<PostListProps> = ({ posts, selectedSlug, onSelect }) => {
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
        <li key={slug}>
          <button
            onClick={() => onSelect(slug)}
            style={{
              display: 'block',
              width: '100%',
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
            }}
            onMouseEnter={(e) => {
              if (slug !== selectedSlug) {
                e.currentTarget.style.background = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (slug !== selectedSlug) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {slug}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default PostList;
