import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
	getAllTags,
	getPostsByTag,
	getPostsByCategory,
	type TagInfo,
} from '../blog-tags';
import type { CollectionEntry } from 'astro:content';

// Minimal mock that satisfies the fields used by blog-tags.ts
type MockPost = CollectionEntry<'blog'>;

function makeMockPost(data: {
	tags: string[];
	category?: string;
	pubDate: Date;
}): MockPost {
	return {
		data: {
			title: 'mock',
			description: 'mock',
			pubDate: data.pubDate,
			tags: data.tags,
			category: data.category,
		},
	} as unknown as MockPost;
}

// --- Arbitraries ---

// Generate a tag string: short non-empty alphanumeric
const arbTag = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

// Generate a category string
const arbCategory = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

// Generate a single mock post with random tags, optional category, and a date
const arbPost = fc
	.record({
		tags: fc.uniqueArray(arbTag, { minLength: 0, maxLength: 6 }),
		category: fc.option(arbCategory, { nil: undefined }),
		pubDate: fc.date({
			min: new Date('2020-01-01'),
			max: new Date('2030-12-31'),
		}),
	})
	.map(makeMockPost);

// Generate a non-empty array of posts
const arbPosts = fc.array(arbPost, { minLength: 1, maxLength: 30 });

// Generate a possibly-empty array of posts
const arbPostsWithEmpty = fc.array(arbPost, { minLength: 0, maxLength: 30 });

// --- Property 3: Tag aggregation correctness ---
// Feature: blog-tag-system, Property 3: Tag aggregation correctness
// Validates: Requirements 2.2, 2.3, 2.4, 7.1
describe('Property 3: Tag aggregation correctness', () => {
	it('returns exactly the unique tags across all posts', () => {
		fc.assert(
			fc.property(arbPostsWithEmpty, (posts) => {
				const result = getAllTags(posts);
				// Collect expected unique tags
				const expectedTags = new Set<string>();
				for (const post of posts) {
					for (const tag of (post.data as any).tags) {
						expectedTags.add(tag);
					}
				}
				// Result length equals number of unique tags
				expect(result.length).toBe(expectedTags.size);
				// Result contains exactly the expected tags
				const resultTagSet = new Set(result.map((t) => t.tag));
				expect(resultTagSet).toEqual(expectedTags);
			}),
			{ numRuns: 100 },
		);
	});

	it('counts each tag correctly', () => {
		fc.assert(
			fc.property(arbPosts, (posts) => {
				const result = getAllTags(posts);
				// Manually count tags
				const expectedCounts = new Map<string, number>();
				for (const post of posts) {
					for (const tag of (post.data as any).tags) {
						expectedCounts.set(tag, (expectedCounts.get(tag) ?? 0) + 1);
					}
				}
				for (const { tag, count } of result) {
					expect(count).toBe(expectedCounts.get(tag));
				}
			}),
			{ numRuns: 100 },
		);
	});

	it('is sorted by count descending', () => {
		fc.assert(
			fc.property(arbPosts, (posts) => {
				const result = getAllTags(posts);
				for (let i = 1; i < result.length; i++) {
					expect(result[i - 1].count).toBeGreaterThanOrEqual(result[i].count);
				}
			}),
			{ numRuns: 100 },
		);
	});
});

// --- Property 4: Post filtering by tag and category ---
// Feature: blog-tag-system, Property 4: Post filtering by tag and category
// Validates: Requirements 3.2, 4.2
describe('Property 4: Post filtering by tag and category', () => {
	it('getPostsByTag returns exactly the posts containing the target tag', () => {
		fc.assert(
			fc.property(
				arbPosts.chain((posts) => {
					// Pick a tag that exists in the posts, or a random one
					const allTags = posts.flatMap((p) => (p.data as any).tags as string[]);
					const tagArb =
						allTags.length > 0
							? fc.oneof(fc.constantFrom(...allTags), arbTag)
							: arbTag;
					return fc.tuple(fc.constant(posts), tagArb);
				}),
				([posts, tag]) => {
					const result = getPostsByTag(posts, tag);
					// Every returned post must contain the tag
					for (const post of result) {
						expect((post.data as any).tags).toContain(tag);
					}
					// Every post with the tag must be in the result
					const expected = posts.filter((p) =>
						((p.data as any).tags as string[]).includes(tag),
					);
					expect(result.length).toBe(expected.length);
				},
			),
			{ numRuns: 100 },
		);
	});

	it('getPostsByCategory returns exactly the posts with the target category', () => {
		fc.assert(
			fc.property(
				arbPosts.chain((posts) => {
					// Pick a category that exists, or a random one
					const allCats = posts
						.map((p) => (p.data as any).category as string | undefined)
						.filter((c): c is string => c !== undefined);
					const catArb =
						allCats.length > 0
							? fc.oneof(fc.constantFrom(...allCats), arbCategory)
							: arbCategory;
					return fc.tuple(fc.constant(posts), catArb);
				}),
				([posts, category]) => {
					const result = getPostsByCategory(posts, category);
					// Every returned post must have the target category
					for (const post of result) {
						expect((post.data as any).category).toBe(category);
					}
					// Every post with the category must be in the result
					const expected = posts.filter(
						(p) => (p.data as any).category === category,
					);
					expect(result.length).toBe(expected.length);
				},
			),
			{ numRuns: 100 },
		);
	});
});

// --- Property 5: Filtered posts are sorted by date descending ---
// Feature: blog-tag-system, Property 5: Filtered posts are sorted by date descending
// Validates: Requirements 3.3, 4.3
describe('Property 5: Filtered posts are sorted by date descending', () => {
	it('getPostsByTag results are sorted by pubDate descending', () => {
		fc.assert(
			fc.property(
				arbPosts.chain((posts) => {
					const allTags = posts.flatMap((p) => (p.data as any).tags as string[]);
					if (allTags.length === 0) return fc.tuple(fc.constant(posts), arbTag);
					return fc.tuple(
						fc.constant(posts),
						fc.constantFrom(...allTags),
					);
				}),
				([posts, tag]) => {
					const result = getPostsByTag(posts, tag);
					for (let i = 1; i < result.length; i++) {
						expect(result[i - 1].data.pubDate.getTime()).toBeGreaterThanOrEqual(
							result[i].data.pubDate.getTime(),
						);
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	it('getPostsByCategory results are sorted by pubDate descending', () => {
		fc.assert(
			fc.property(
				arbPosts.chain((posts) => {
					const allCats = posts
						.map((p) => (p.data as any).category as string | undefined)
						.filter((c): c is string => c !== undefined);
					if (allCats.length === 0)
						return fc.tuple(fc.constant(posts), arbCategory);
					return fc.tuple(
						fc.constant(posts),
						fc.constantFrom(...allCats),
					);
				}),
				([posts, category]) => {
					const result = getPostsByCategory(posts, category);
					for (let i = 1; i < result.length; i++) {
						expect(result[i - 1].data.pubDate.getTime()).toBeGreaterThanOrEqual(
							result[i].data.pubDate.getTime(),
						);
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});

// --- Schema property tests ---
// Use zod directly since Astro runtime is not available in test context
import { z } from 'zod';

// Mirror the tags and category schema from content.config.ts
const tagsSchema = z
	.array(z.string())
	.default([])
	.refine((tags) => new Set(tags).size === tags.length, {
		message: 'Duplicate tags are not allowed',
	});
const categorySchema = z.string().optional();

// --- Property 1: Schema accepts valid frontmatter and rejects invalid types ---
// Feature: blog-tag-system, Property 1: Schema accepts valid frontmatter and rejects invalid types
// Validates: Requirements 1.1, 1.2
describe('Property 1: Schema accepts valid frontmatter and rejects invalid types', () => {
	it('accepts valid tags arrays of unique strings', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(arbTag, { minLength: 0, maxLength: 10 }),
				(tags) => {
					const result = tagsSchema.safeParse(tags);
					expect(result.success).toBe(true);
				},
			),
			{ numRuns: 100 },
		);
	});

	it('accepts undefined tags (defaults to empty array)', () => {
		const result = tagsSchema.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual([]);
		}
	});

	it('rejects tags when elements are not strings', () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.oneof(
						fc.integer(),
						fc.boolean(),
						fc.constant(null),
						fc.record({ key: fc.string() }),
					),
					{ minLength: 1, maxLength: 5 },
				),
				(invalidTags) => {
					const result = tagsSchema.safeParse(invalidTags);
					expect(result.success).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});

	it('accepts valid category strings', () => {
		fc.assert(
			fc.property(arbCategory, (category) => {
				const result = categorySchema.safeParse(category);
				expect(result.success).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});

	it('accepts undefined category', () => {
		const result = categorySchema.safeParse(undefined);
		expect(result.success).toBe(true);
		expect(result.data).toBeUndefined();
	});

	it('rejects category when value is not a string', () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.integer(),
					fc.boolean(),
					fc.array(fc.string()),
					fc.record({ key: fc.string() }),
				),
				(invalidCategory) => {
					const result = categorySchema.safeParse(invalidCategory);
					expect(result.success).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});
});

// --- Property 2: Duplicate tags are rejected ---
// Feature: blog-tag-system, Property 2: Duplicate tags are rejected
// Validates: Requirements 1.5
describe('Property 2: Duplicate tags are rejected', () => {
	it('rejects any tags array containing at least one duplicate', () => {
		fc.assert(
			fc.property(
				fc
					.record({
						base: fc.uniqueArray(arbTag, { minLength: 0, maxLength: 5 }),
						dup: arbTag,
						insertIdx: fc.nat(),
					})
					.map(({ base, dup, insertIdx }) => {
						// Ensure the duplicate tag appears at least twice
						const tags = [...base.filter((t) => t !== dup), dup, dup];
						// Shuffle the duplicate into a random position for variety
						const idx = insertIdx % tags.length;
						const moved = tags.splice(tags.length - 1, 1)[0];
						tags.splice(idx, 0, moved);
						return tags;
					}),
				(tagsWithDup) => {
					const result = tagsSchema.safeParse(tagsWithDup);
					expect(result.success).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});
});

// --- Property 6: Tag display truncation ---
// Feature: blog-tag-system, Property 6: Tag display truncation
// Validates: Requirements 5.4
import { truncateTags, MAX_DISPLAY_TAGS } from '../blog-tags';

describe('Property 6: Tag display truncation', () => {
	it('shows all tags with no remainder when length <= MAX_DISPLAY_TAGS', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(arbTag, { minLength: 0, maxLength: MAX_DISPLAY_TAGS }),
				(tags) => {
					const { visible, remaining } = truncateTags(tags);
					expect(visible).toEqual(tags);
					expect(remaining).toBe(0);
				},
			),
			{ numRuns: 100 },
		);
	});

	it('shows exactly first MAX_DISPLAY_TAGS tags and correct remainder when length > MAX_DISPLAY_TAGS', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(arbTag, { minLength: MAX_DISPLAY_TAGS + 1, maxLength: 20 }),
				(tags) => {
					const { visible, remaining } = truncateTags(tags);
					expect(visible).toEqual(tags.slice(0, MAX_DISPLAY_TAGS));
					expect(remaining).toBe(tags.length - MAX_DISPLAY_TAGS);
				},
			),
			{ numRuns: 100 },
		);
	});

	it('visible.length + remaining always equals tags.length', () => {
		fc.assert(
			fc.property(
				fc.array(arbTag, { minLength: 0, maxLength: 20 }),
				(tags) => {
					const { visible, remaining } = truncateTags(tags);
					expect(visible.length + remaining).toBe(tags.length);
				},
			),
			{ numRuns: 100 },
		);
	});
});
