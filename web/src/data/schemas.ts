// Zod schemas for YAML-based data collections.
// Single source of truth for validation — parsers delegate to these schemas.

import { z } from 'astro:content';

/** Thought YAML schema */
export const thoughtSchema = z.object({
  content: z.string().min(1),
  createdAt: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid date' }),
  tags: z.array(z.string()).optional(),
  mood: z.string().optional(),
});

/** Friend link YAML schema */
export const friendSchema = z.object({
  name: z.string().min(1),
  url: z.string().default('#'),
  avatar: z.string().default(''),
  description: z.string().default(''),
  tags: z.array(z.string()).optional(),
});

/** Wish YAML schema */
export const wishSchema = z.object({
  title: z.string().min(1),
  status: z.enum(['wish', 'doing', 'done']),
  category: z.string().default('other'),
  createdAt: z.union([z.string(), z.date().transform((d) => d.toISOString().slice(0, 10))]).default(
    () => new Date().toISOString().slice(0, 10),
  ),
  doneAt: z.union([z.string(), z.date().transform((d) => d.toISOString().slice(0, 10))]).optional(),
  note: z.string().optional(),
});

/** Image variant descriptor */
export const imageVariantSchema = z.object({
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.enum(['webp', 'avif', 'jpg', 'png', 'gif']).optional(),
});

/** Gallery image entry schema */
export const galleryImageSchema = z.object({
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.enum(['webp', 'avif', 'jpg', 'png', 'gif']),
  variants: z.array(imageVariantSchema).min(1),
  album: z.string().optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().optional(),
  source: z.enum(['cdn', 'local']).default('cdn'),
  takenAt: z.string().optional(),
});
