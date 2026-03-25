import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '~/consts';
import { loadThoughts } from '~/data/thoughts';
import { INLINE_STICKER_RE, BLOCK_STICKER_RE } from '~/lib/sticker';

/** Strip sticker syntax from text for RSS output */
function stripStickers(text) {
	return text
		.replace(new RegExp(BLOCK_STICKER_RE.source, 'gm'), '')
		.replace(new RegExp(INLINE_STICKER_RE.source, 'g'), '')
		.trim();
}

export async function GET(context) {
	const posts = await getCollection('blog');
	const thoughts = await loadThoughts();

	const blogItems = posts.map((post) => ({
		...post.data,
		categories: ['文章', ...(post.data.tags ?? [])],
		link: `/blog/${post.id}/`,
	}));

	const thoughtItems = thoughts.map((t) => {
		const clean = stripStickers(t.content);
		return {
		title: `💭 ${clean.slice(0, 50)}${clean.length > 50 ? '…' : ''}`,
		description: clean,
		pubDate: new Date(t.createdAt),
		link: `/thoughts/#thought-${t.id}`,
		categories: ['想法', ...(t.tags ?? [])],
	};
	});

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
