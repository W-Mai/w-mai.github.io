/** Post metadata for filtering and sorting in the editor */
export interface PostInfo {
  slug: string;
  title: string;
  tags: string[];
  category: string;
  pubDate: string;
}

export type SortField = 'pubDate' | 'title' | 'slug';
export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  searchTerm: string;
  selectedTags: string[];
  selectedCategory: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

export const DEFAULT_FILTER: FilterOptions = {
  searchTerm: '',
  selectedTags: [],
  selectedCategory: '',
  sortField: 'pubDate',
  sortDirection: 'desc',
};

/** Extract unique tags from post list, sorted alphabetically */
export function collectTags(posts: PostInfo[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    for (const t of p.tags) set.add(t);
  }
  return [...set].sort();
}

/** Extract unique non-empty categories from post list, sorted alphabetically */
export function collectCategories(posts: PostInfo[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    if (p.category) set.add(p.category);
  }
  return [...set].sort();
}

/** Apply full filter pipeline: search → tag → category → sort */
export function filterAndSortPosts(posts: PostInfo[], options: FilterOptions): PostInfo[] {
  let result = posts;

  // Text search: match slug or title (case-insensitive)
  if (options.searchTerm) {
    const lower = options.searchTerm.toLowerCase();
    result = result.filter(
      (p) => p.slug.toLowerCase().includes(lower) || p.title.toLowerCase().includes(lower),
    );
  }

  // Tag filter: OR logic — post must have at least one selected tag
  if (options.selectedTags.length > 0) {
    const tagSet = new Set(options.selectedTags);
    result = result.filter((p) => p.tags.some((t) => tagSet.has(t)));
  }

  // Category filter: exact match
  if (options.selectedCategory) {
    result = result.filter((p) => p.category === options.selectedCategory);
  }

  // Sort
  const dir = options.sortDirection === 'asc' ? 1 : -1;
  result = [...result].sort((a, b) => {
    const av = a[options.sortField];
    const bv = b[options.sortField];

    // For pubDate, empty string is treated as oldest (smallest value)
    if (options.sortField === 'pubDate') {
      if (!av && !bv) return 0;
      if (!av) return -1 * dir;
      if (!bv) return 1 * dir;
    }

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  return result;
}

/** Count active filter dimensions (tags + category) */
export function countActiveFilters(options: FilterOptions): number {
  let count = 0;
  if (options.selectedTags.length > 0) count++;
  if (options.selectedCategory) count++;
  return count;
}

/**
 * Smart date formatter with relative context:
 * - Today → "HH:mm"
 * - This year → "MM/DD HH:mm"
 * - Other years → "YYYY/MM/DD HH:mm"
 * Falls back to raw date portion if time is missing.
 */
export function formatSmartDate(dateStr: string, now: Date = new Date()): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const mmdd = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;

  const sameYear = d.getFullYear() === now.getFullYear();
  const sameDay = sameYear && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

  if (sameDay) return hhmm;
  if (sameYear) return `${mmdd} ${hhmm}`;
  return `${d.getFullYear()}/${mmdd} ${hhmm}`;
}

/** @deprecated Use formatSmartDate instead */
export function formatCompactDate(dateStr: string): string {
  return formatSmartDate(dateStr);
}
