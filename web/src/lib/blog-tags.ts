/**
 * Tag and category data utility functions.
 * Pure functions that operate on a posts array for easy testing and reuse.
 */
import type { CollectionEntry } from 'astro:content';

export interface TagInfo {
	tag: string;
	count: number;
}

export interface CategoryInfo {
	category: string;
	count: number;
}

/**
 * Get all tags with post counts, sorted by count descending.
 * Only includes tags that appear in at least one post.
 */
export function getAllTags(posts: CollectionEntry<'blog'>[]): TagInfo[] {
	const tagCounts = new Map<string, number>();

	for (const post of posts) {
		for (const tag of post.data.tags) {
			tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
		}
	}

	return Array.from(tagCounts.entries())
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count);
}

/**
 * Get posts filtered by tag, sorted by pubDate descending.
 */
export function getPostsByTag(
	posts: CollectionEntry<'blog'>[],
	tag: string,
): CollectionEntry<'blog'>[] {
	return posts
		.filter((post) => post.data.tags.includes(tag))
		.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/**
 * Get all unique categories with post counts, sorted by count descending.
 * Only includes categories that are defined (skips posts without a category).
 */
export function getAllCategories(posts: CollectionEntry<'blog'>[]): CategoryInfo[] {
	const categoryCounts = new Map<string, number>();

	for (const post of posts) {
		const { category } = post.data;
		if (category) {
			categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
		}
	}

	return Array.from(categoryCounts.entries())
		.map(([category, count]) => ({ category, count }))
		.sort((a, b) => b.count - a.count);
}

/**
 * Get posts filtered by category, sorted by pubDate descending.
 */
export function getPostsByCategory(
	posts: CollectionEntry<'blog'>[],
	category: string,
): CollectionEntry<'blog'>[] {
	return posts
		.filter((post) => post.data.category === category)
		.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/** Maximum number of tags to display before truncation */
export const MAX_DISPLAY_TAGS = 3;

/**
 * Truncate a tags array for display purposes.
 * Returns the visible tags (up to MAX_DISPLAY_TAGS) and the remaining count.
 */
export function truncateTags(tags: string[]): { visible: string[]; remaining: number } {
	return {
		visible: tags.slice(0, MAX_DISPLAY_TAGS),
		remaining: Math.max(0, tags.length - MAX_DISPLAY_TAGS),
	};
}

