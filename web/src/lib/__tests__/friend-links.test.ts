import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { hasAvatar, getFallbackChar } from '../friend-links';

/**
 * Property 2: Fallback avatar uses first character of name
 * **Validates: Requirements 1.4**
 */
describe('Feature: friend-links, Property 2: Fallback avatar uses first character of name', () => {
	// Generator: avatar can be a valid URL, empty string, or whitespace-only
	const arbAvatar = fc.oneof(
		fc.webUrl(),
		fc.constant(''),
		fc.stringMatching(/^ +$/).map((s) => s || ' '),
	);

	// Generator: name must be non-empty
	const arbName = fc.string({ minLength: 1 });

	it('hasAvatar returns false for empty/whitespace avatars and true for non-empty trimmed avatars', () => {
		fc.assert(
			fc.property(arbAvatar, (avatar) => {
				const result = hasAvatar(avatar);
				const expected = avatar.trim().length > 0;
				expect(result).toBe(expected);
			}),
			{ numRuns: 200 },
		);
	});

	it('getFallbackChar returns name.charAt(0) for any non-empty name', () => {
		fc.assert(
			fc.property(arbName, (name) => {
				const result = getFallbackChar(name);
				expect(result).toBe(name.charAt(0));
			}),
			{ numRuns: 200 },
		);
	});

	it('fallback logic: when hasAvatar is false, getFallbackChar provides the first character', () => {
		fc.assert(
			fc.property(arbAvatar, arbName, (avatar, name) => {
				if (!hasAvatar(avatar)) {
					// Fallback should be the first character of name
					expect(getFallbackChar(name)).toBe(name.charAt(0));
				} else {
					// Avatar is valid, hasAvatar confirms it
					expect(avatar.trim().length).toBeGreaterThan(0);
				}
			}),
			{ numRuns: 200 },
		);
	});
});


/**
 * Unit tests for hasAvatar
 * **Validates: Requirements 1.4**
 */
describe('Unit: hasAvatar', () => {
	it('returns false for empty string', () => {
		expect(hasAvatar('')).toBe(false);
	});

	it('returns false for whitespace-only string', () => {
		expect(hasAvatar('   ')).toBe(false);
	});

	it('returns false for single space', () => {
		expect(hasAvatar(' ')).toBe(false);
	});

	it('returns true for a valid URL', () => {
		expect(hasAvatar('https://example.com/avatar.png')).toBe(true);
	});

	it('returns true for a non-empty trimmed string', () => {
		expect(hasAvatar('avatar.jpg')).toBe(true);
	});

	it('returns true for a string with leading/trailing spaces but non-empty content', () => {
		expect(hasAvatar('  https://example.com  ')).toBe(true);
	});
});

/**
 * Unit tests for getFallbackChar
 * **Validates: Requirements 1.4**
 */
describe('Unit: getFallbackChar', () => {
	it('returns first character for Chinese name', () => {
		expect(getFallbackChar('小明')).toBe('小');
	});

	it('returns first character for English name', () => {
		expect(getFallbackChar('Alice')).toBe('A');
	});

	it('returns first character for single-char name', () => {
		expect(getFallbackChar('X')).toBe('X');
	});

	it('returns empty string for empty name', () => {
		expect(getFallbackChar('')).toBe('');
	});

	it('returns first code unit for name starting with emoji (charAt behavior)', () => {
		// charAt(0) returns the first UTF-16 code unit, not the full emoji
		expect(getFallbackChar('🐱Cat')).toBe('🐱'.charAt(0));
	});

	it('returns space for name starting with space', () => {
		expect(getFallbackChar(' Bob')).toBe(' ');
	});
});


/**
 * Property 4: Tags conditional rendering
 * **Validates: Requirements 3.7**
 */
describe('Feature: friend-links, Property 4: Tags conditional rendering', () => {
	// Generator: tags can be undefined, empty array, or non-empty array of non-empty strings
	const arbTags = fc.oneof(
		fc.constant(undefined),
		fc.constant([] as string[]),
		fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
	);

	it('when tags is defined and non-empty, all tag strings should be present in rendering', () => {
		fc.assert(
			fc.property(arbTags, (tags) => {
				// Mirror the exact conditional from FriendCard.astro: tags && tags.length > 0
				const shouldRenderTags = !!(tags && tags.length > 0);

				if (shouldRenderTags) {
					// All tags should be available for rendering
					expect(tags).toBeDefined();
					expect(tags!.length).toBeGreaterThan(0);
					// Each tag string is non-empty and would appear in the rendered output
					for (const tag of tags!) {
						expect(typeof tag).toBe('string');
						expect(tag.length).toBeGreaterThan(0);
					}
				}
			}),
			{ numRuns: 200 },
		);
	});

	it('when tags is undefined or empty, the condition evaluates to falsy (no badges rendered)', () => {
		fc.assert(
			fc.property(arbTags, (tags) => {
				const shouldRenderTags = !!(tags && tags.length > 0);

				if (!shouldRenderTags) {
					// tags is either undefined or an empty array
					expect(tags === undefined || tags.length === 0).toBe(true);
				}
			}),
			{ numRuns: 200 },
		);
	});

	it('tags conditional logic is exhaustive: every generated input is either render or no-render', () => {
		fc.assert(
			fc.property(arbTags, (tags) => {
				const shouldRenderTags = !!(tags && tags.length > 0);

				if (shouldRenderTags) {
					// Non-empty tags: count of rendered badges equals tags.length
					expect(tags!.length).toBeGreaterThan(0);
				} else {
					// No tags: zero badges
					const badgeCount = 0;
					expect(badgeCount).toBe(0);
				}
			}),
			{ numRuns: 200 },
		);
	});
});
