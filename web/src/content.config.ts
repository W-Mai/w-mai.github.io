import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files from the root-level `posts/` directory
	loader: glob({ base: '../posts', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			// Tag list, defaults to empty array, rejects duplicates at build time
			tags: z
				.array(z.string())
				.default([])
				.refine((tags) => new Set(tags).size === tags.length, {
					message: 'Duplicate tags are not allowed',
				}),
			// Optional category for coarse-grained classification
			category: z.string().optional(),
		}),
});

export const collections = { blog };
