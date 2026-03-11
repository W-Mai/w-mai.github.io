import { useState, useMemo, type FC } from 'react';
import { EDITOR_TOKENS as T } from './editor-tokens';
import {
  filterAndSortPosts, collectTags, collectCategories,
  countActiveFilters, formatSmartDate, DEFAULT_FILTER,
  type PostInfo, type SortField, type FilterOptions,
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
      <div style={{ padding: `${T.spacingMd} ${T.spacingLg}`, borderBottom: `1px solid ${T.colorBorderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingSm }}>
          <input
            type="text"
            value={filter.searchTerm}
            onChange={(e) => setFilter((f) => ({ ...f, searchTerm: e.target.value }))}
            placeholder="Search posts..."
            style={{
              flex: 1, padding: `${T.spacingSm} ${T.spacingMd}`,
              border: 'none', borderRadius: T.radiusSm,
              fontSize: T.fontSizeSm, outline: 'none', boxSizing: 'border-box',
              fontFamily: T.fontSans, color: T.colorText,
              background: T.colorBg, boxShadow: T.shadowInset,
              transition: `box-shadow 0.2s ease`,
            }}
          />
          <button
            className="editor-btn"
            onClick={cycleSortField}
            title={`Sort by ${filter.sortField}`}
            style={{
              background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
              padding: `${T.spacingSm} ${T.spacingSm}`, fontSize: T.fontSizeMd,
              cursor: 'pointer', color: T.colorTextSecondary, lineHeight: 1,
              boxShadow: T.shadowBtn, transition: `all 0.2s ease`,
            }}
          >
            {SORT_ICONS[filter.sortField]}
          </button>
          <button
            className="editor-btn"
            onClick={toggleSortDir}
            title={filter.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            style={{
              background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
              padding: `${T.spacingSm} ${T.spacingSm}`, fontSize: T.fontSizeMd,
              cursor: 'pointer', color: T.colorTextSecondary, lineHeight: 1,
              boxShadow: T.shadowBtn, transition: `all 0.2s ease`,
            }}
          >
            {filter.sortDirection === 'asc' ? '↑' : '↓'}
          </button>
          <button
            className="editor-btn"
            onClick={() => setShowTitle((v) => !v)}
            title={showTitle ? 'Show filenames' : 'Show titles'}
            style={{
              background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
              padding: `${T.spacingSm} ${T.spacingSm}`, fontSize: T.fontSizeMd,
              cursor: 'pointer', color: T.colorTextSecondary, lineHeight: 1,
              boxShadow: T.shadowBtn, transition: `all 0.2s ease`,
            }}
          >
            {showTitle ? 'Aa' : '📄'}
          </button>
        </div>

        {/* Filter status bar */}
        {(activeCount > 0 || filter.searchTerm) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: T.spacingSm,
            fontSize: T.fontSizeSm, color: T.colorTextMuted, marginTop: T.spacingSm,
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
                    color: T.colorTextMuted, fontSize: T.fontSizeSm, padding: 0,
                    textDecoration: 'underline', transition: `color 0.2s ease`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = T.colorText; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = T.colorTextMuted; }}
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
              color: T.colorTextMuted, fontSize: T.fontSizeSm, padding: `${T.spacingSm} 0`,
              display: 'flex', alignItems: 'center', gap: T.spacingSm,
              transition: `color 0.2s ease`, width: '100%',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.colorText; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.colorTextMuted; }}
          >
            <span style={{
              fontSize: T.fontSizeXs,
              transform: filterOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              display: 'inline-block',
            }}>▶</span>
            <span>Filters</span>
          </button>
        )}

        {/* Expanded filter bar */}
        <div style={{
          maxHeight: filterOpen ? '200px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
        }}>
          <div style={{ paddingTop: T.spacingSm }}>
            {/* Tag chips */}
            {allTags.length > 0 && (
              <div style={{ marginBottom: T.spacingSm }}>
                <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: '4px' }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {allTags.map((tag) => {
                    const active = filter.selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        className={!active ? 'editor-btn' : ''}
                        onClick={() => toggleTag(tag)}
                        style={{
                          background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                          padding: '2px 8px', fontSize: T.fontSizeXs, cursor: 'pointer',
                          color: active ? T.colorText : T.colorTextMuted,
                          fontWeight: active ? 600 : 400,
                          boxShadow: active ? T.shadowInset : T.shadowBtn,
                          transition: `all 0.2s ease`,
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
                <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: '4px' }}>Category</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {allCategories.map((cat) => {
                    const active = filter.selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        className={!active ? 'editor-btn' : ''}
                        onClick={() => setCategory(cat)}
                        style={{
                          background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                          padding: '2px 8px', fontSize: T.fontSizeXs, cursor: 'pointer',
                          color: active ? T.colorText : T.colorTextMuted,
                          fontWeight: active ? 600 : 400,
                          boxShadow: active ? T.shadowInset : T.shadowBtn,
                          transition: `all 0.2s ease`,
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
        </div>
      </div>

      {/* Post list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {posts.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeMd }}>
            No posts found.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeSm }}>
            No matching posts
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: `${T.spacingSm} 0` }}>
            {filtered.map((post, idx) => {
              const label = showTitle ? (post.title || post.slug) : post.slug;
              const date = formatSmartDate(post.pubDate);
              const tooltipParts = [post.title || post.slug];
              if (post.tags.length > 0) tooltipParts.push(`Tags: ${post.tags.join(', ')}`);
              if (post.category) tooltipParts.push(`Category: ${post.category}`);
              const isSelected = post.slug === selectedSlug;

              return (
                <li key={post.slug} style={{
                  display: 'flex', alignItems: 'center',
                  animation: `editorPanelItemIn 0.2s ease both`,
                  animationDelay: `${Math.min(idx * 30, 300)}ms`,
                }}>
                  <button
                    onClick={() => onSelect(post.slug)}
                    title={tooltipParts.join('\n')}
                    style={{
                      flex: 1, padding: `${T.spacingMd} ${T.spacingLg}`,
                      border: 'none',
                      background: isSelected ? T.colorBgTertiary : 'transparent',
                      color: isSelected ? T.colorText : T.colorTextSecondary,
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: T.fontSizeMd, textAlign: 'left', cursor: 'pointer',
                      borderLeft: isSelected ? `3px solid ${T.colorAccent}` : '3px solid transparent',
                      transition: `all 0.2s ease`,
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = T.colorBgSecondary;
                        e.currentTarget.style.color = T.colorText;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = T.colorTextSecondary;
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: T.spacingSm,
                      overflow: 'hidden',
                    }}>
                      <span style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {label}
                      </span>
                      {post.category && (
                        <span style={{
                          fontSize: T.fontSizeXs, color: T.colorTextMuted,
                          background: T.colorBgTertiary, borderRadius: T.radiusSm,
                          padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {post.category}
                        </span>
                      )}
                    </div>
                    {date && (
                      <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginTop: '2px' }}>
                        {date}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(post.slug); }}
                    title={`Delete ${post.slug}`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#d1d5db', fontSize: T.fontSizeSm, padding: T.spacingMd,
                      marginRight: T.spacingSm, borderRadius: T.radiusSm,
                      transition: `color 0.2s ease`,
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
