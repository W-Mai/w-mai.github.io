/**
 * Reading stats utility library.
 * Pure functions for word counting, reading time estimation,
 * and blog statistics aggregation.
 */

// CJK Unified Ideographs range
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

/**
 * Strip MDX/Markdown syntax, HTML tags, code blocks, front matter,
 * and import statements from content.
 */
export function stripMarkdown(content: string): string {
	let text = content;

	// Remove front matter (--- ... ---)
	text = text.replace(/^---[\s\S]*?---\n?/, '');

	// Remove import statements
	text = text.replace(/^import\s+.*$/gm, '');

	// Remove fenced code blocks (``` ... ``` or ~~~ ... ~~~)
	text = text.replace(/(`{3,}|~{3,})[\s\S]*?\1/g, '');

	// Remove inline code
	text = text.replace(/`[^`]*`/g, '');

	// Remove HTML tags
	text = text.replace(/<[^>]*>/g, '');

	// Remove images ![alt](url)
	text = text.replace(/!\[.*?\]\(.*?\)/g, '');

	// Remove links but keep text [text](url)
	text = text.replace(/\[([^\]]*)\]\(.*?\)/g, '$1');

	// Remove headings markers
	text = text.replace(/^#{1,6}\s+/gm, '');

	// Remove bold/italic markers
	text = text.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2');

	// Remove strikethrough
	text = text.replace(/~~(.*?)~~/g, '$1');

	// Remove blockquotes
	text = text.replace(/^>\s?/gm, '');

	// Remove horizontal rules
	text = text.replace(/^[-*_]{3,}\s*$/gm, '');

	// Remove list markers
	text = text.replace(/^[\s]*[-*+]\s+/gm, '');
	text = text.replace(/^[\s]*\d+\.\s+/gm, '');

	return text.trim();
}

/**
 * Count words in text: Chinese characters counted individually,
 * English words counted by whitespace separation.
 */
export function countWords(text: string): {
	chinese: number;
	english: number;
	total: number;
} {
	// Count CJK characters
	const chineseMatches = text.match(CJK_REGEX);
	const chinese = chineseMatches ? chineseMatches.length : 0;

	// Remove CJK characters, then count English words by whitespace
	const withoutCJK = text.replace(CJK_REGEX, ' ');
	const englishWords = withoutCJK
		.split(/\s+/)
		.filter((w) => w.length > 0);
	const english = englishWords.length;

	return { chinese, english, total: chinese + english };
}

/**
 * Estimate reading time in minutes.
 * Chinese: 300 chars/min, English: 200 words/min.
 * Returns rounded-up integer, minimum 1.
 */
export function estimateReadingTime(content: string): number {
	const stripped = stripMarkdown(content);
	const { chinese, english } = countWords(stripped);
	const minutes = chinese / 300 + english / 200;
	return Math.max(1, Math.ceil(minutes));
}

/**
 * Format reading time for display.
 * < 1 min content → "不到 1 分钟"
 * >= 1 min content → "约 X 分钟"
 */
export function formatReadingTime(content: string): string {
	const stripped = stripMarkdown(content);
	const { chinese, english } = countWords(stripped);
	const rawMinutes = chinese / 300 + english / 200;

	if (rawMinutes < 1) {
		return '不到 1 分钟';
	}
	return `约 ${Math.ceil(rawMinutes)} 分钟`;
}

/**
 * Compute aggregate stats for all blog posts.
 */
export function computeBlogStats(
	posts: Array<{ body: string; pubDate: Date }>,
): {
	totalPosts: number;
	totalWords: number;
	averageWords: number;
	earliestDate: Date;
	latestDate: Date;
} {
	const totalPosts = posts.length;

	if (totalPosts === 0) {
		return {
			totalPosts: 0,
			totalWords: 0,
			averageWords: 0,
			earliestDate: new Date(),
			latestDate: new Date(),
		};
	}

	let totalWords = 0;
	let earliestDate = posts[0].pubDate;
	let latestDate = posts[0].pubDate;

	for (const post of posts) {
		const stripped = stripMarkdown(post.body);
		totalWords += countWords(stripped).total;

		if (post.pubDate < earliestDate) earliestDate = post.pubDate;
		if (post.pubDate > latestDate) latestDate = post.pubDate;
	}

	const averageWords = Math.round(totalWords / totalPosts);

	return { totalPosts, totalWords, averageWords, earliestDate, latestDate };
}
