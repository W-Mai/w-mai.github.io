/**
 * Astro static endpoint that generates the search index JSON at build time.
 * Outputs /search-index.json containing all blog posts and thoughts.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { loadThoughts } from '~/data/thoughts';
import { loadFriends } from '~/data/friends';
import { loadWishes } from '~/data/wishes';
import { stripMdx, type SearchIndexEntry } from '~/lib/search-engine';

export const GET: APIRoute = async () => {
  const [posts, thoughts, friends, wishes] = await Promise.all([
    getCollection('blog'),
    loadThoughts(),
    loadFriends(),
    loadWishes(),
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

  const friendEntries: SearchIndexEntry[] = friends
    .filter((f) => !f.id.startsWith('placeholder-'))
    .map((f) => ({
      id: `friend-${f.id}`,
      title: f.name,
      description: f.description,
      tags: f.tags ?? [],
      body: [f.name, f.description, f.url].filter(Boolean).join(' '),
      slug: f.id,
      type: 'friend',
    }));

  const wishEntries: SearchIndexEntry[] = wishes.map((w) => ({
    id: `wish-${w.id}`,
    title: w.title,
    description: w.note ?? '',
    tags: [w.category, w.status],
    body: [w.title, w.note ?? '', w.category].join(' '),
    slug: w.id,
    type: 'wish',
  }));

  return new Response(
    JSON.stringify([...blogEntries, ...thoughtEntries, ...friendEntries, ...wishEntries]), {
    headers: { 'Content-Type': 'application/json' },
  });
};
