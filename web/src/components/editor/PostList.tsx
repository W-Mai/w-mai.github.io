import { useState, useMemo, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';
import {
  filterAndSortPosts, collectTags, collectCategories,
  countActiveFilters, formatCompactDate, DEFAULT_FILTER,
  type PostInfo, type SortField, type SortDirection, type FilterOptions,
} from '../../lib/post-filter';

export type { PostInfo };

interface PostListProps {
  posts: PostInfo[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onDelete: (slug: string) => void;
}

const SORT_ICONS: Record<SortField, string> = { pubDate: '📅', title: 'Aa', slug: '📄' };
const SORT_FIELDS: SortField[] = ['pubDate', 'title', 'slug'];

const PostList: FC<PostListProps> = ({ posts, selectedSlug, onSelect, onDelete }) => {
  const [showTitle, setShowTitle] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<FilterOptions>(DEFAULT_FILTER);

  const allTags = useMemo(() => collectTags(posts), [posts]);
  const allCategories = useMemo(() => collectCategories(posts), [posts]);
  const filtered = useMemo(() => filterAndSortPosts(posts, filter), [posts, filter]);
  const activeCount = useMemo(() => countActiveFilters(filter), [filter]);

  const toggleTag = (tag: string) => {
    setFilter((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((t) => t !== tag)
        : [...f.selectedTags, tag],
    }));
  };

  const setCategory = (cat: string) => {
    setFilter((f) => ({ ...f, selectedCategory: f.selectedCategory === cat ? '' : cat }));
  };

  const clearFilters = () => {
    setFilter((f) => ({ ...f, selectedTags: [], selectedCategory: '' }));
  };

  const cycleSortField = () => {
    setFilter((f) => {
      const idx = SORT_FIELDS.indexOf(f.sortField);
      return { ...f, sortField: SORT_FIELDS[(idx + 1) % SORT_FIELDS.length] };
    });
  };

  const toggleSortDir = () => {
    setFilter((f) => ({ ...f, sortDirection: f.sortDirection === 'asc' ? 'desc' : 'asc' }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search + sort + toggle row */}
      <div style={{ padding: `${T.spacingSm} ${T.spacingMd}`, borderBottom: `1px solid ${T.colorBorderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingXs }}>
          <input
            type="text"
            value={filter.searchTerm}
            onChange={(e) => setFilter((f) => ({ ...f, searchTerm: e.target.value }))}
            placeholder="Filter posts..."
            style={{
              flex: 1, padding: `${T.spacingXs} ${T.spacingSm}`,
              border: 'none', borderRadius: T.radiusSm,
              fontSize: T.fontSizeXs, outline: 'none', boxSizing: 'border-box',
              fontFamily: T.fontSans, color: T.colorText,
              background: T.colorBg, boxShadow: T.shadowInset,
              transition: `box-shadow ${T.transitionFast}`,
            }}
          />
          <button
            onClick={cycleSortField}
            title={`Sort by ${filter.sortField}`}
            style={{
              background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
              padding: `${T.spacingXs} 0.35rem`, fontSize: T.fontSizeXs,
              cursor: 'pointer', color: T.colorTextSecondary, lineHeight: 1,
              boxShadow: T.shadowBtn, transition: `all ${T.transitionFast}`,
            }}
          >
            {SORT_ICONS[filter.sortField]}
          </button>
          <button
            onClick={toggleSortDir}
            title={filter.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            style={{
              background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
              padding: `${T.spacingXs} 0.3rem`, fontSize: T.fontSizeXs,
              cursor: 'pointer', color: T.colorTextSecondary, lineHeight: 1,
              boxShadow: T.shadowBtn, transition: `all ${T.transitionFast}`,
            }}
          >
            {filter.sortDirection === 'asc' ? '↑' : '↓'}
          </button>
          <button
            onClick={() => setShowTitle((v) => !v)}
            title={showTitle ? 'Show filenames' : 'Show titles'}
            style={{
              background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
              padding: `${T.spacingXs} 0.35rem`, fontSize: T.fontSizeXs,
              cursor: 'pointer', color: T.colorTextSecondary, lineHeight: 1,
              boxShadow: T.shadowBtn, transition: `all ${T.transitionFast}`,
            }}
          >
            {showTitle ? 'Aa' : '📄'}
          </button>
        </div>

        {/* Filter status bar */}
        {(activeCount > 0 || filter.searchTerm) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: T.spacingXs,
            fontSize: T.fontSizeXs, color: T.colorTextMuted, marginTop: T.spacingXs,
          }}>
            <span>{filtered.length} / {posts.length}</span>
            {activeCount > 0 && (
              <>
                <span>·</span>
                <span>{activeCount} filter{activeCount > 1 ? 's' : ''}</span>
                <button
                  onClick={clearFilters}
                  title="Clear all filters"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.colorTextMuted, fontSize: T.fontSizeXs, padding: 0,
                    textDecoration: 'underline', transition: `color ${T.transitionFast}`,
                  }}
                >
                  clear
                </button>
              </>
            )}
          </div>
        )}

        {/* Filter bar toggle */}
        {(allTags.length > 0 || allCategories.length > 0) && (
          <button
            onClick={() => setFilterOpen((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.colorTextMuted, fontSize: T.fontSizeXs, padding: `${T.spacingXs} 0`,
              display: 'flex', alignItems: 'center', gap: T.spacingXs,
              transition: `color ${T.transitionFast}`, width: '100%',
            }}
          >
            <span style={{ fontSize: '0.6rem' }}>{filterOpen ? '▼' : '▶'}</span>
            <span>Filters</span>
          </button>
        )}

        {/* Expanded filter bar */}
        {filterOpen && (
          <div style={{ marginTop: T.spacingXs }}>
            {/* Tag chips */}
            {allTags.length > 0 && (
              <div style={{ marginBottom: T.spacingXs }}>
                <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: '2px' }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {allTags.map((tag) => {
                    const active = filter.selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        style={{
                          background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                          padding: '1px 6px', fontSize: '0.6rem', cursor: 'pointer',
                          color: active ? T.colorText : T.colorTextMuted,
                          fontWeight: active ? 600 : 400,
                          boxShadow: active ? T.shadowInset : T.shadowBtn,
                          transition: `all ${T.transitionFast}`,
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category options */}
            {allCategories.length > 0 && (
              <div>
                <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: '2px' }}>Category</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {allCategories.map((cat) => {
                    const active = filter.selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        style={{
                          background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                          padding: '1px 6px', fontSize: '0.6rem', cursor: 'pointer',
                          color: active ? T.colorText : T.colorTextMuted,
                          fontWeight: active ? 600 : 400,
                          boxShadow: active ? T.shadowInset : T.shadowBtn,
                          transition: `all ${T.transitionFast}`,
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
              const date = formatCompactDate(post.pubDate);
              const tooltipParts = [post.title || post.slug];
              if (post.tags.length > 0) tooltipParts.push(`Tags: ${post.tags.join(', ')}`);
              if (post.category) tooltipParts.push(`Category: ${post.category}`);

              return (
                <li key={post.slug} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => onSelect(post.slug)}
                    title={tooltipParts.join('\n')}
                    style={{
                      flex: 1, padding: `0.5rem ${T.spacingXl}`,
                      border: 'none',
                      background: post.slug === selectedSlug ? T.colorBgTertiary : 'transparent',
                      color: post.slug === selectedSlug ? T.colorText : T.colorTextSecondary,
                      fontWeight: post.slug === selectedSlug ? 600 : 400,
                      fontSize: T.fontSizeBase, textAlign: 'left', cursor: 'pointer',
                      borderLeft: post.slug === selectedSlug ? `2px solid ${T.colorAccent}` : '2px solid transparent',
                      transition: `all ${T.transitionFast}`,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: T.spacingXs,
                      overflow: 'hidden',
                    }}>
                      <span style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {label}
                      </span>
                      {post.category && (
                        <span style={{
                          fontSize: '0.55rem', color: T.colorTextMuted,
                          background: T.colorBgTertiary, borderRadius: T.radiusSm,
                          padding: '0 4px', whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {post.category}
                        </span>
                      )}
                    </div>
                    {date && (
                      <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginTop: '1px' }}>
                        {date}
                      </div>
                    )}
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
