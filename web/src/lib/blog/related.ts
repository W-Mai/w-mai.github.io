/**
 * Related posts utility functions.
 * Pure functions that operate on a posts array for easy testing and reuse.
 */
import type { CollectionEntry } from 'astro:content';

export interface RelatedPostInfo {
	id: string;
	title: string;
	pubDate: Date;
}

/**
 * Find posts related to the given post by shared tags and category.
 * Overlap score = number of shared tags + 1 if same category.
 * Ranked by overlap count descending, then pubDate descending.
 * Excludes the current post. Returns at most `limit` results.
 */
export function getRelatedPosts(
	allPosts: CollectionEntry<'blog'>[],
	currentPost: CollectionEntry<'blog'>,
	limit: number = 5,
): RelatedPostInfo[] {
	const currentTags = new Set(currentPost.data.tags);
	const currentCategory = currentPost.data.category;

	return allPosts
		.filter((p) => p.id !== currentPost.id)
		.map((p) => {
			let score = 0;
			for (const tag of p.data.tags) {
				if (currentTags.has(tag)) score++;
			}
			if (currentCategory && p.data.category === currentCategory) score++;
			return { post: p, score };
		})
		.filter(({ score }) => score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.post.data.pubDate.getTime() - a.post.data.pubDate.getTime(),
		)
		.slice(0, limit)
		.map(({ post }) => ({
			id: post.id,
			title: post.data.title,
			pubDate: post.data.pubDate,
		}));
}
