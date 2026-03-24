import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { loadThoughts } from '../data/thoughts';

export async function GET(context) {
	const posts = await getCollection('blog');
	const thoughts = await loadThoughts();

	const blogItems = posts.map((post) => ({
		...post.data,
		categories: ['文章', ...(post.data.tags ?? [])],
		link: `/blog/${post.id}/`,
	}));

	const thoughtItems = thoughts.map((t) => ({
		title: `💭 ${t.content.slice(0, 50)}${t.content.length > 50 ? '…' : ''}`,
		description: t.content,
		pubDate: new Date(t.createdAt),
		link: `/thoughts/#thought-${t.id}`,
		categories: ['想法', ...(t.tags ?? [])],
	}));

	const items = [...blogItems, ...thoughtItems].sort(
		(a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
	);

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items,
	});
}
