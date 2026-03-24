/**
 * Blog archive utility functions.
 * Pure functions that operate on a posts array for easy testing and reuse.
 */
import type { CollectionEntry } from 'astro:content';
import { siteYear, siteMonth } from './date-utils';

export interface MonthGroup {
	month: number; // 1-12
	count: number;
}

export interface YearGroup {
	year: number;
	months: MonthGroup[];
}

/**
 * Group posts by year and month based on pubDate.
 * Years sorted descending, months within each year sorted descending.
 */
export function getArchiveGroups(posts: CollectionEntry<'blog'>[]): YearGroup[] {
	const map = new Map<number, Map<number, number>>();

	for (const post of posts) {
		const year = siteYear(post.data.pubDate);
		const month = siteMonth(post.data.pubDate);
		if (!map.has(year)) map.set(year, new Map());
		const monthMap = map.get(year)!;
		monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
	}

	return Array.from(map.entries())
		.map(([year, monthMap]) => ({
			year,
			months: Array.from(monthMap.entries())
				.map(([month, count]) => ({ month, count }))
				.sort((a, b) => b.month - a.month),
		}))
		.sort((a, b) => b.year - a.year);
}

/**
 * Filter posts by year and month, sorted by pubDate descending.
 */
export function getPostsByYearMonth(
	posts: CollectionEntry<'blog'>[],
	year: number,
	month: number,
): CollectionEntry<'blog'>[] {
	return posts
		.filter((p) => siteYear(p.data.pubDate) === year && siteMonth(p.data.pubDate) === month)
		.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/**
 * Get all unique year/month pairs from posts (for getStaticPaths).
 * Sorted by year descending, then month descending.
 */
export function getAllYearMonthPairs(
	posts: CollectionEntry<'blog'>[],
): Array<{ year: number; month: number }> {
	const seen = new Set<string>();
	const pairs: Array<{ year: number; month: number }> = [];

	for (const post of posts) {
		const year = siteYear(post.data.pubDate);
		const month = siteMonth(post.data.pubDate);
		const key = `${year}-${month}`;
		if (!seen.has(key)) {
			seen.add(key);
			pairs.push({ year, month });
		}
	}

	return pairs.sort((a, b) => b.year - a.year || b.month - a.month);
}
