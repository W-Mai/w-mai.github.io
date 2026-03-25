import { describe, it, expect } from 'vitest';
import {
	stripMarkdown,
	countWords,
	formatReadingTime,
	computeBlogStats,
} from '../blog/reading-stats';

// --- stripMarkdown ---

describe('stripMarkdown', () => {
	it('removes fenced code blocks', () => {
		const input = 'before\n```js\nconsole.log("hi");\n```\nafter';
		const result = stripMarkdown(input);
		expect(result).not.toContain('console.log');
		expect(result).toContain('before');
		expect(result).toContain('after');
	});

	it('removes tilde fenced code blocks', () => {
		const input = 'text\n~~~python\nprint("hello")\n~~~\nmore';
		const result = stripMarkdown(input);
		expect(result).not.toContain('print');
	});

	it('removes inline code', () => {
		const input = 'use `const x = 1` here';
		const result = stripMarkdown(input);
		expect(result).not.toContain('const x = 1');
		expect(result).toContain('use');
		expect(result).toContain('here');
	});

	it('removes HTML tags', () => {
		const input = '<div class="test">content</div>';
		const result = stripMarkdown(input);
		expect(result).not.toContain('<div');
		expect(result).not.toContain('</div>');
		expect(result).toContain('content');
	});

	it('removes front matter', () => {
		const input = '---\ntitle: Hello\ndate: 2024-01-01\n---\nBody text';
		const result = stripMarkdown(input);
		expect(result).not.toContain('title: Hello');
		expect(result).toContain('Body text');
	});

	it('removes import statements', () => {
		const input = 'import Component from "./Component";\nimport { a } from "b";\nReal content';
		const result = stripMarkdown(input);
		expect(result).not.toContain('import');
		expect(result).toContain('Real content');
	});

	it('removes images but keeps link text', () => {
		const input = '![alt](image.png) and [click here](https://example.com)';
		const result = stripMarkdown(input);
		expect(result).not.toContain('image.png');
		expect(result).toContain('click here');
	});

	it('removes heading markers', () => {
		const input = '## Hello World\n### Sub heading';
		const result = stripMarkdown(input);
		expect(result).toContain('Hello World');
		expect(result).not.toMatch(/^##/m);
	});
});

// --- countWords ---

describe('countWords', () => {
	it('counts pure Chinese characters', () => {
		const result = countWords('你好世界测试');
		expect(result.chinese).toBe(6);
		expect(result.english).toBe(0);
		expect(result.total).toBe(6);
	});

	it('counts pure English words', () => {
		const result = countWords('hello world foo bar');
		expect(result.chinese).toBe(0);
		expect(result.english).toBe(4);
		expect(result.total).toBe(4);
	});

	it('counts mixed Chinese and English content', () => {
		const result = countWords('你好 hello 世界 world');
		expect(result.chinese).toBe(4);
		expect(result.english).toBe(2);
		expect(result.total).toBe(6);
	});

	it('returns zero for empty string', () => {
		const result = countWords('');
		expect(result.chinese).toBe(0);
		expect(result.english).toBe(0);
		expect(result.total).toBe(0);
	});

	it('returns zero for whitespace only', () => {
		const result = countWords('   \n\t  ');
		expect(result.chinese).toBe(0);
		expect(result.english).toBe(0);
		expect(result.total).toBe(0);
	});
});

// --- formatReadingTime ---
// Validates: Requirements 1.4, 9.3

describe('formatReadingTime', () => {
	it('returns "不到 1 分钟" for empty content', () => {
		expect(formatReadingTime('')).toBe('不到 1 分钟');
	});

	it('returns "不到 1 分钟" for whitespace-only content', () => {
		expect(formatReadingTime('   \n  ')).toBe('不到 1 分钟');
	});

	it('returns "不到 1 分钟" for 1 Chinese character', () => {
		// 1 char / 300 cpm = 0.003 min → < 1 min
		expect(formatReadingTime('你')).toBe('不到 1 分钟');
	});

	it('returns "不到 1 分钟" for 299 Chinese characters', () => {
		// 299 / 300 = 0.997 min → < 1 min
		const content = '中'.repeat(299);
		expect(formatReadingTime(content)).toBe('不到 1 分钟');
	});

	it('returns "约 1 分钟" for exactly 300 Chinese characters', () => {
		// 300 / 300 = 1.0 min → ceil = 1 → "约 1 分钟"
		const content = '中'.repeat(300);
		expect(formatReadingTime(content)).toBe('约 1 分钟');
	});

	it('returns "约 2 分钟" for 301 Chinese characters', () => {
		// 301 / 300 = 1.003 min → ceil = 2
		const content = '中'.repeat(301);
		expect(formatReadingTime(content)).toBe('约 2 分钟');
	});

	it('handles content with markdown that strips to empty', () => {
		const content = '```js\nconsole.log("hi");\n```';
		expect(formatReadingTime(content)).toBe('不到 1 分钟');
	});
});

// --- computeBlogStats ---

describe('computeBlogStats', () => {
	it('handles empty array', () => {
		const result = computeBlogStats([]);
		expect(result.totalPosts).toBe(0);
		expect(result.totalWords).toBe(0);
		expect(result.averageWords).toBe(0);
	});

	it('computes correct stats for a single post', () => {
		const posts = [
			{ body: '你好世界', pubDate: new Date('2024-01-15') },
		];
		const result = computeBlogStats(posts);
		expect(result.totalPosts).toBe(1);
		expect(result.totalWords).toBe(4);
		expect(result.averageWords).toBe(4);
		expect(result.earliestDate).toEqual(new Date('2024-01-15'));
		expect(result.latestDate).toEqual(new Date('2024-01-15'));
	});

	it('computes correct stats for multiple posts', () => {
		const posts = [
			{ body: '你好', pubDate: new Date('2024-01-01') },
			{ body: 'hello world', pubDate: new Date('2024-06-15') },
			{ body: '测试 test', pubDate: new Date('2024-03-10') },
		];
		const result = computeBlogStats(posts);
		expect(result.totalPosts).toBe(3);
		// post1: 2 chinese, post2: 2 english, post3: 2 chinese + 1 english = 7
		expect(result.totalWords).toBe(7);
		expect(result.averageWords).toBe(Math.round(7 / 3));
		expect(result.earliestDate).toEqual(new Date('2024-01-01'));
		expect(result.latestDate).toEqual(new Date('2024-06-15'));
	});

	it('strips markdown before counting words', () => {
		const posts = [
			{
				body: '---\ntitle: test\n---\n```js\ncode\n```\n你好世界',
				pubDate: new Date('2024-01-01'),
			},
		];
		const result = computeBlogStats(posts);
		// Only "你好世界" (4 chars) should be counted after stripping
		expect(result.totalWords).toBe(4);
	});
});

// --- Property-Based Tests (fast-check) ---

import fc from 'fast-check';
import { estimateReadingTime } from '../blog/reading-stats';

// Shared generators

/** Generate a random string of CJK characters */
const arbChineseString = fc.stringMatching(/[\u4e00-\u9fff]+/).filter((s) => s.length > 0);

/** Generate a random English word (letters only) */
const arbEnglishWord = fc.stringMatching(/[a-zA-Z]+/).filter((s) => s.length > 0);

/** Generate mixed Chinese+English content (plain text, no markdown) */
const arbMixedContent = fc
	.tuple(
		fc.array(fc.stringMatching(/[\u4e00-\u9fff]+/), { minLength: 0, maxLength: 20 }),
		fc.array(
			fc.stringMatching(/[a-zA-Z]+/).filter((s) => s.length > 0),
			{ minLength: 0, maxLength: 20 },
		),
	)
	.map(([chineseFragments, englishWords]) => {
		// Interleave Chinese fragments and English words with spaces
		const parts: string[] = [];
		const maxLen = Math.max(chineseFragments.length, englishWords.length);
		for (let i = 0; i < maxLen; i++) {
			if (i < chineseFragments.length) parts.push(chineseFragments[i]);
			if (i < englishWords.length) parts.push(englishWords[i]);
		}
		return parts.join(' ');
	});

// CJK regex for counting in tests (same as implementation)
const CJK_REGEX_TEST = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

/**
 * Property 1: Reading time formula correctness
 * **Validates: Requirements 1.2, 1.3, 1.5, 9.2, 9.4**
 */
describe('Feature: reading-stats, Property 1: Reading time formula correctness', () => {
	it('estimateReadingTime matches Math.max(1, Math.ceil(chinese/300 + english/200))', () => {
		fc.assert(
			fc.property(arbMixedContent, (content) => {
				const result = estimateReadingTime(content);

				// Manually compute expected value using the same pipeline
				const stripped = stripMarkdown(content);
				const { chinese, english } = countWords(stripped);
				const expected = Math.max(1, Math.ceil(chinese / 300 + english / 200));

				expect(result).toBe(expected);
			}),
			{ numRuns: 200 },
		);
	});
});

/**
 * Property 2: Markdown stripping completeness
 * **Validates: Requirements 1.6, 9.5**
 */
describe('Feature: reading-stats, Property 2: Markdown stripping completeness', () => {
	/** Generate content with random markdown syntax elements */
	const arbMarkdownContent = fc
		.tuple(
			fc.constantFrom(
				'---\ntitle: test\ndate: 2024-01-01\n---\n',
				'',
			),
			fc.array(
				fc.oneof(
					// Fenced code blocks
					fc.tuple(
						fc.constantFrom('```', '~~~'),
						fc.constantFrom('js', 'python', 'ts', ''),
						fc.stringMatching(/[a-zA-Z0-9 =;()]+/).filter((s) => s.length > 0),
					).map(([fence, lang, code]) => `${fence}${lang}\n${code}\n${fence}`),
					// HTML tags
					fc.tuple(
						fc.constantFrom('div', 'span', 'p', 'br', 'img'),
						fc.stringMatching(/[a-zA-Z ]+/).filter((s) => s.length > 0),
					).map(([tag, text]) =>
						tag === 'br' || tag === 'img'
							? `<${tag} />`
							: `<${tag}>${text}</${tag}>`,
					),
					// Inline code
					fc.stringMatching(/[a-zA-Z0-9 =]+/).filter((s) => s.length > 0)
						.map((code) => `\`${code}\``),
					// Plain text (should survive stripping)
					fc.stringMatching(/[a-zA-Z\u4e00-\u9fff]+/).filter((s) => s.length > 0),
				),
				{ minLength: 1, maxLength: 10 },
			),
		)
		.map(([frontMatter, parts]) => frontMatter + parts.join('\n'));

	it('stripMarkdown output contains no code fences, HTML tags, or front matter', () => {
		fc.assert(
			fc.property(arbMarkdownContent, (content) => {
				const result = stripMarkdown(content);

				// No fenced code block markers
				expect(result).not.toMatch(/(`{3,}|~{3,})/);
				// No HTML tags
				expect(result).not.toMatch(/<[^>]*>/);
				// No front matter delimiters at start
				expect(result).not.toMatch(/^---[\s\S]*?---/);
			}),
			{ numRuns: 200 },
		);
	});
});

/**
 * Property 3: Format label correctness
 * **Validates: Requirements 1.4, 4.2, 9.3**
 */
describe('Feature: reading-stats, Property 3: Format label correctness', () => {
	it('formatReadingTime returns correct label based on reading time threshold', () => {
		fc.assert(
			fc.property(arbMixedContent, (content) => {
				const label = formatReadingTime(content);
				const stripped = stripMarkdown(content);
				const { chinese, english } = countWords(stripped);
				const rawMinutes = chinese / 300 + english / 200;

				if (rawMinutes < 1) {
					expect(label).toBe('不到 1 分钟');
				} else {
					const rounded = Math.ceil(rawMinutes);
					expect(label).toBe(`约 ${rounded} 分钟`);
				}
			}),
			{ numRuns: 200 },
		);
	});
});

/**
 * Property 4: Blog stats aggregation correctness
 * **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
 */
describe('Feature: reading-stats, Property 4: Blog stats aggregation correctness', () => {
	const arbBlogPost = fc.record({
		body: arbMixedContent,
		pubDate: fc.date({
			min: new Date('2020-01-01'),
			max: new Date('2030-12-31'),
			noInvalidDate: true,
		}),
	});

	const arbBlogPosts = fc.array(arbBlogPost, { minLength: 1, maxLength: 15 });

	it('computeBlogStats returns correct aggregated values', () => {
		fc.assert(
			fc.property(arbBlogPosts, (posts) => {
				const result = computeBlogStats(posts);

				// totalPosts equals array length
				expect(result.totalPosts).toBe(posts.length);

				// totalWords equals sum of individual word counts
				let expectedTotalWords = 0;
				for (const post of posts) {
					const stripped = stripMarkdown(post.body);
					expectedTotalWords += countWords(stripped).total;
				}
				expect(result.totalWords).toBe(expectedTotalWords);

				// averageWords equals Math.round(totalWords / totalPosts)
				const expectedAverage = Math.round(expectedTotalWords / posts.length);
				expect(result.averageWords).toBe(expectedAverage);

				// earliestDate is the minimum pubDate
				const expectedEarliest = new Date(
					Math.min(...posts.map((p) => p.pubDate.getTime())),
				);
				expect(result.earliestDate.getTime()).toBe(expectedEarliest.getTime());

				// latestDate is the maximum pubDate
				const expectedLatest = new Date(
					Math.max(...posts.map((p) => p.pubDate.getTime())),
				);
				expect(result.latestDate.getTime()).toBe(expectedLatest.getTime());
			}),
			{ numRuns: 200 },
		);
	});
});

/**
 * Property 7: Reading time idempotence
 * **Validates: Requirements 9.1**
 */
describe('Feature: reading-stats, Property 7: Reading time idempotence', () => {
	it('estimateReadingTime(x) === estimateReadingTime(x) for any content', () => {
		fc.assert(
			fc.property(
				fc.oneof(
					arbMixedContent,
					fc.string(),
					fc.constant(''),
				),
				(content) => {
					const first = estimateReadingTime(content);
					const second = estimateReadingTime(content);
					expect(first).toBe(second);
				},
			),
			{ numRuns: 200 },
		);
	});
});
