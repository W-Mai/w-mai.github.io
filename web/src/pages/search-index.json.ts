/**
 * Astro static endpoint that generates the search index JSON at build time.
 * Outputs /search-index.json containing all blog posts and thoughts.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { loadThoughts } from '~/data/thoughts';
import { stripMdx, type SearchIndexEntry } from '~/lib/search-engine';

export const GET: APIRoute = async () => {
  const [posts, thoughts] = await Promise.all([
    getCollection('blog'),
    loadThoughts(),
  ]);

  const blogEntries: SearchIndexEntry[] = posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    tags: post.data.tags,
    body: stripMdx(post.body ?? ''),
    slug: post.id,
    type: 'blog',
  }));

  const thoughtEntries: SearchIndexEntry[] = thoughts.map((t) => ({
    id: `thought-${t.id}`,
    title: t.content.slice(0, 50),
    description: t.content,
    tags: t.tags ?? [],
    body: t.content.replace(/::?sticker\[[^\]]*\]::?/g, ''),
    slug: t.id,
    type: 'thought',
  }));

  return new Response(JSON.stringify([...blogEntries, ...thoughtEntries]), {
    headers: { 'Content-Type': 'application/json' },
  });
};
