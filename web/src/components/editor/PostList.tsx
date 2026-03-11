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

  const hasFilters = allTags.length > 0 || allCategories.length > 0;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left sidebar — filter panel */}
      {hasFilters && (
        <div style={{
          width: '180px', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${T.colorBorderLight}`,
          overflow: 'auto',
          padding: T.spacingLg,
          gap: T.spacingLg,
        }}>
          {/* Sort controls */}
          <div style={{ display: 'flex', gap: T.spacingSm }}>
            <button
              className="editor-btn"
              onClick={cycleSortField}
              title={`Sort by ${filter.sortField}`}
              style={{
                background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                width: '2rem', height: '2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: T.colorTextSecondary,
                fontSize: T.fontSizeMd,
                boxShadow: T.shadowBtn, transition: 'all 0.2s ease',
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
                width: '2rem', height: '2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: T.colorTextSecondary,
                fontSize: T.fontSizeMd,
                boxShadow: T.shadowBtn, transition: 'all 0.2s ease',
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
                width: '2rem', height: '2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: T.colorTextSecondary,
                fontSize: T.fontSizeMd,
                boxShadow: T.shadowBtn, transition: 'all 0.2s ease',
              }}
            >
              {showTitle ? 'Aa' : '📄'}
            </button>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: T.spacingSm }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allTags.map((tag) => {
                  const active = filter.selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      className={!active ? 'editor-btn' : ''}
                      onClick={() => toggleTag(tag)}
                      style={{
                        background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                        padding: '3px 10px', fontSize: T.fontSizeXs, cursor: 'pointer',
                        color: active ? T.colorText : T.colorTextMuted,
                        fontWeight: active ? 600 : 400,
                        boxShadow: active ? T.shadowInset : T.shadowBtn,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories */}
          {allCategories.length > 0 && (
            <div>
              <div style={{ fontSize: T.fontSizeXs, color: T.colorTextMuted, marginBottom: T.spacingSm }}>Category</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allCategories.map((cat) => {
                  const active = filter.selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      className={!active ? 'editor-btn' : ''}
                      onClick={() => setCategory(cat)}
                      style={{
                        background: T.colorBg, border: 'none', borderRadius: T.radiusSm,
                        padding: '3px 10px', fontSize: T.fontSizeXs, cursor: 'pointer',
                        color: active ? T.colorText : T.colorTextMuted,
                        fontWeight: active ? 600 : 400,
                        boxShadow: active ? T.shadowInset : T.shadowBtn,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active filter count + clear */}
          {activeCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: T.spacingSm,
              fontSize: T.fontSizeXs, color: T.colorTextMuted,
            }}>
              <span>{activeCount} active</span>
              <button
                onClick={clearFilters}
                title="Clear all filters"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.colorTextMuted, fontSize: T.fontSizeXs, padding: 0,
                  textDecoration: 'underline', transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = T.colorText; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = T.colorTextMuted; }}
              >
                clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Right side — search + file list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Search bar */}
        <div style={{ padding: `${T.spacingLg} ${T.spacingXl}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: T.spacingMd }}>
            <input
              type="text"
              value={filter.searchTerm}
              onChange={(e) => setFilter((f) => ({ ...f, searchTerm: e.target.value }))}
              placeholder="Search posts..."
              style={{
                flex: 1, padding: `${T.spacingMd} ${T.spacingLg}`,
                border: 'none', borderRadius: T.radiusMd,
                fontSize: T.fontSizeMd, outline: 'none', boxSizing: 'border-box',
                fontFamily: T.fontSans, color: T.colorText,
                background: T.colorBg, boxShadow: T.shadowInset,
                transition: 'box-shadow 0.2s ease',
              }}
            />
            {/* Show sort/display buttons when no filter sidebar */}
            {!hasFilters && (
              <>
                <button
                  className="editor-btn"
                  onClick={cycleSortField}
                  title={`Sort by ${filter.sortField}`}
                  style={{
                    background: T.colorBg, border: 'none', borderRadius: T.radiusMd,
                    width: '2rem', height: '2rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: T.colorTextSecondary,
                    fontSize: T.fontSizeMd,
                    boxShadow: T.shadowBtn, transition: 'all 0.2s ease',
                  }}
                >
                  {SORT_ICONS[filter.sortField]}
                </button>
                <button
                  className="editor-btn"
                  onClick={toggleSortDir}
                  title={filter.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                  style={{
                    background: T.colorBg, border: 'none', borderRadius: T.radiusMd,
                    width: '2rem', height: '2rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: T.colorTextSecondary,
                    fontSize: T.fontSizeMd,
                    boxShadow: T.shadowBtn, transition: 'all 0.2s ease',
                  }}
                >
                  {filter.sortDirection === 'asc' ? '↑' : '↓'}
                </button>
                <button
                  className="editor-btn"
                  onClick={() => setShowTitle((v) => !v)}
                  title={showTitle ? 'Show filenames' : 'Show titles'}
                  style={{
                    background: T.colorBg, border: 'none', borderRadius: T.radiusMd,
                    width: '2rem', height: '2rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: T.colorTextSecondary,
                    fontSize: T.fontSizeMd,
                    boxShadow: T.shadowBtn, transition: 'all 0.2s ease',
                  }}
                >
                  {showTitle ? 'Aa' : '📄'}
                </button>
              </>
            )}
          </div>
          {/* Result count */}
          {(activeCount > 0 || filter.searchTerm) && (
            <div style={{
              fontSize: T.fontSizeXs, color: T.colorTextMuted, marginTop: T.spacingSm,
            }}>
              {filtered.length} / {posts.length}
            </div>
          )}
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflow: 'auto', padding: T.spacingLg }}>
          {posts.length === 0 ? (
            <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeMd }}>
              No posts found.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: T.spacingXl, color: T.colorTextMuted, fontSize: T.fontSizeSm }}>
              No matching posts
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: T.spacingLg }}>
              {filtered.map((post, idx) => {
                const label = showTitle ? (post.title || post.slug) : post.slug;
                const date = formatSmartDate(post.pubDate);
                const tooltipParts = [post.title || post.slug];
                if (post.tags.length > 0) tooltipParts.push(`Tags: ${post.tags.join(', ')}`);
                if (post.category) tooltipParts.push(`Category: ${post.category}`);
                const isSelected = post.slug === selectedSlug;

                return (
                  <li
                    key={post.slug}
                    className={!isSelected ? 'editor-btn' : ''}
                    onClick={() => onSelect(post.slug)}
                    title={tooltipParts.join('\n')}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: `${T.spacingMd} ${T.spacingLg}`,
                      background: T.colorBg, borderRadius: T.radiusMd,
                      boxShadow: isSelected ? T.shadowInset : T.shadowBtn,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      animation: 'editorPanelItemIn 0.2s ease both',
                      animationDelay: `${Math.min(idx * 30, 300)}ms`,
                    }}
                  >
                    <div style={{
                      flex: 1, minWidth: 0, overflow: 'hidden',
                      color: isSelected ? T.colorText : T.colorTextSecondary,
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: T.fontSizeMd,
                    }}>
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
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(post.slug); }}
                      title={`Delete ${post.slug}`}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--border-subtle)', fontSize: T.fontSizeSm,
                        padding: T.spacingMd, flexShrink: 0,
                        borderRadius: T.radiusSm,
                        transition: 'color 0.2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = T.colorError; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--border-subtle)'; }}
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
    </div>
  );
};

export default PostList;
