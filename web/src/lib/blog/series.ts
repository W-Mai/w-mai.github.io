/**
 * Blog series/collection utility functions.
 * Pure functions that operate on a posts array for easy testing and reuse.
 */
import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

/** Summary info for a series, used on the series index page. */
export interface SeriesInfo {
	slug: string;
	title: string;
	count: number;
	latestDate: Date;
}

/** Full series data including ordered posts, used in SeriesNav and series detail page. */
export interface SeriesData {
	info: SeriesInfo;
	posts: BlogPost[];
}

/**
 * Get all series with summary info, sorted by latest post date descending.
 * Only includes series with at least one post.
 */
export function getAllSeries(posts: BlogPost[]): SeriesInfo[] {
	const map = new Map<string, { title: string; count: number; latestDate: Date }>();

	for (const post of posts) {
		const { series, seriesTitle, pubDate } = post.data;
		if (!series) continue;
		const existing = map.get(series);
		if (existing) {
			existing.count++;
			if (pubDate > existing.latestDate) existing.latestDate = pubDate;
		} else {
			map.set(series, { title: seriesTitle ?? series, count: 1, latestDate: pubDate });
		}
	}

	return Array.from(map.entries())
		.map(([slug, { title, count, latestDate }]) => ({ slug, title, count, latestDate }))
		.sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
}

/**
 * Get posts in a series, sorted by seriesOrder ascending (undefined treated as 0).
 * Returns empty array if the series does not exist.
 */
export function getPostsBySeries(posts: BlogPost[], seriesSlug: string): BlogPost[] {
	return posts
		.filter((p) => p.data.series === seriesSlug)
		.sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
}

/**
 * Get full series data for the series a post belongs to.
 * Returns null if the post has no series or the postId is not found.
 */
export function getSeriesForPost(posts: BlogPost[], postId: string): SeriesData | null {
	const post = posts.find((p) => p.id === postId);
	if (!post?.data.series) return null;

	const slug = post.data.series;
	const seriesPosts = getPostsBySeries(posts, slug);
	const latestDate = seriesPosts.reduce(
		(max, p) => (p.data.pubDate > max ? p.data.pubDate : max),
		seriesPosts[0].data.pubDate,
	);

	return {
		info: {
			slug,
			title: post.data.seriesTitle ?? slug,
			count: seriesPosts.length,
			latestDate,
		},
		posts: seriesPosts,
	};
}
