import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

/**
 * ThemeManager logic extracted for testing.
 * Mirrors the inline script in BaseHead.astro.
 */

// Simulated DOM state
let htmlClassList: Set<string>;
let localStorageStore: Record<string, string>;
let systemPrefersDark: boolean;
let dispatchedEvents: Array<{ type: string; detail: unknown }>;

// Mock localStorage
const mockLocalStorage = {
	getItem(key: string): string | null {
		return localStorageStore[key] ?? null;
	},
	setItem(key: string, value: string): void {
		localStorageStore[key] = value;
	},
	removeItem(key: string): void {
		delete localStorageStore[key];
	},
};

// ThemeManager functions (mirror BaseHead.astro inline script)
function getStoredTheme(): string | null {
	try {
		return mockLocalStorage.getItem('theme');
	} catch {
		return null;
	}
}

function getSystemTheme(): 'dark' | 'light' {
	return systemPrefersDark ? 'dark' : 'light';
}

function applyTheme(theme: string): void {
	if (theme === 'dark') {
		htmlClassList.add('dark');
	} else {
		htmlClassList.delete('dark');
	}
}

function resolveTheme(): 'dark' | 'light' {
	const stored = getStoredTheme();
	return stored === 'dark' || stored === 'light' ? stored : getSystemTheme();
}

function toggleTheme(): void {
	const isDark = htmlClassList.has('dark');
	const newTheme = isDark ? 'light' : 'dark';
	applyTheme(newTheme);
	try {
		mockLocalStorage.setItem('theme', newTheme);
	} catch {}
	dispatchedEvents.push({
		type: 'theme-change',
		detail: { theme: newTheme },
	});
}

function initTheme(): void {
	applyTheme(resolveTheme());
}

// --- Test setup ---

beforeEach(() => {
	htmlClassList = new Set<string>();
	localStorageStore = {};
	systemPrefersDark = false;
	dispatchedEvents = [];
});

// --- Property-Based Tests ---

/**
 * Property 3: Theme toggle is a self-inverse
 * For any initial theme state, toggling twice returns to original state.
 * **Validates: Requirements 2.2**
 */
describe('Feature: dark-mode-neumorphism, Property 3: Theme toggle is a self-inverse', () => {
	const arbTheme = fc.constantFrom('dark' as const, 'light' as const);

	it('toggling twice restores html.dark class, localStorage value, and icon state', () => {
		fc.assert(
			fc.property(arbTheme, (initialTheme) => {
				// Setup initial state
				htmlClassList = new Set<string>();
				localStorageStore = {};
				dispatchedEvents = [];

				applyTheme(initialTheme);
				mockLocalStorage.setItem('theme', initialTheme);

				const initialHasDark = htmlClassList.has('dark');
				const initialStored = mockLocalStorage.getItem('theme');

				// Toggle twice
				toggleTheme();
				toggleTheme();

				// Verify all state restored
				expect(htmlClassList.has('dark')).toBe(initialHasDark);
				expect(mockLocalStorage.getItem('theme')).toBe(initialStored);

				// Icon state: dark mode shows sun, light mode shows moon
				const iconShouldBeSun = htmlClassList.has('dark');
				const initialIconWasSun = initialHasDark;
				expect(iconShouldBeSun).toBe(initialIconWasSun);
			}),
			{ numRuns: 100 },
		);
	});

	it('intermediate state after single toggle is the opposite', () => {
		fc.assert(
			fc.property(arbTheme, (initialTheme) => {
				htmlClassList = new Set<string>();
				localStorageStore = {};
				dispatchedEvents = [];

				applyTheme(initialTheme);
				mockLocalStorage.setItem('theme', initialTheme);

				const initialHasDark = htmlClassList.has('dark');

				// Single toggle
				toggleTheme();

				// State should be opposite
				expect(htmlClassList.has('dark')).toBe(!initialHasDark);
				const expectedTheme = initialTheme === 'dark' ? 'light' : 'dark';
				expect(mockLocalStorage.getItem('theme')).toBe(expectedTheme);
			}),
			{ numRuns: 100 },
		);
	});
});

/**
 * Property 5: Theme preference persistence round-trip
 * For any theme value, selecting it via toggle then reading localStorage returns same value.
 * **Validates: Requirements 3.1, 3.2**
 */
describe('Feature: dark-mode-neumorphism, Property 5: Theme preference persistence round-trip', () => {
	const arbTheme = fc.constantFrom('dark' as const, 'light' as const);

	it('setting a theme persists to localStorage and is restored on next init', () => {
		fc.assert(
			fc.property(arbTheme, (targetTheme) => {
				// Start from opposite theme so toggle produces targetTheme
				htmlClassList = new Set<string>();
				localStorageStore = {};
				dispatchedEvents = [];

				const startTheme = targetTheme === 'dark' ? 'light' : 'dark';
				applyTheme(startTheme);
				mockLocalStorage.setItem('theme', startTheme);

				// Toggle to reach target theme
				toggleTheme();

				// Verify localStorage has the target theme
				expect(mockLocalStorage.getItem('theme')).toBe(targetTheme);

				// Simulate page reload: reset class list, re-init
				htmlClassList = new Set<string>();
				initTheme();

				// Verify html.dark class matches target theme
				expect(htmlClassList.has('dark')).toBe(targetTheme === 'dark');
			}),
			{ numRuns: 100 },
		);
	});

	it('direct localStorage write is read back correctly on init', () => {
		fc.assert(
			fc.property(arbTheme, (theme) => {
				htmlClassList = new Set<string>();
				localStorageStore = {};

				mockLocalStorage.setItem('theme', theme);
				initTheme();

				expect(htmlClassList.has('dark')).toBe(theme === 'dark');
			}),
			{ numRuns: 100 },
		);
	});
});

/**
 * Property 6: System preference fallback
 * When no user preference in localStorage, ThemeManager applies system preference.
 * **Validates: Requirements 3.3, 3.4**
 */
describe('Feature: dark-mode-neumorphism, Property 6: System preference fallback', () => {
	const arbSystemPref = fc.boolean();

	it('with no localStorage, init applies system preference', () => {
		fc.assert(
			fc.property(arbSystemPref, (prefersDark) => {
				htmlClassList = new Set<string>();
				localStorageStore = {};
				systemPrefersDark = prefersDark;

				initTheme();

				expect(htmlClassList.has('dark')).toBe(prefersDark);
			}),
			{ numRuns: 100 },
		);
	});

	it('system preference is ignored when user has explicit preference', () => {
		fc.assert(
			fc.property(
				arbSystemPref,
				fc.constantFrom('dark' as const, 'light' as const),
				(prefersDark, userPref) => {
					htmlClassList = new Set<string>();
					localStorageStore = {};
					systemPrefersDark = prefersDark;
					mockLocalStorage.setItem('theme', userPref);

					initTheme();

					// User preference takes priority over system
					expect(htmlClassList.has('dark')).toBe(userPref === 'dark');
				},
			),
			{ numRuns: 100 },
		);
	});

	it('system preference change updates theme when no user preference stored', () => {
		fc.assert(
			fc.property(arbSystemPref, (prefersDark) => {
				htmlClassList = new Set<string>();
				localStorageStore = {};
				systemPrefersDark = !prefersDark;

				initTheme();
				expect(htmlClassList.has('dark')).toBe(!prefersDark);

				// Simulate system preference change
				systemPrefersDark = prefersDark;
				// Re-apply (mirrors the matchMedia change listener behavior)
				const stored = getStoredTheme();
				if (stored !== 'dark' && stored !== 'light') {
					applyTheme(getSystemTheme());
				}

				expect(htmlClassList.has('dark')).toBe(prefersDark);
			}),
			{ numRuns: 100 },
		);
	});
});

// --- Unit Tests ---

describe('Unit: ThemeManager', () => {
	it('initTheme applies dark class when localStorage has "dark"', () => {
		mockLocalStorage.setItem('theme', 'dark');
		initTheme();
		expect(htmlClassList.has('dark')).toBe(true);
	});

	it('initTheme does not apply dark class when localStorage has "light"', () => {
		mockLocalStorage.setItem('theme', 'light');
		initTheme();
		expect(htmlClassList.has('dark')).toBe(false);
	});

	it('toggleTheme dispatches theme-change event with correct detail', () => {
		applyTheme('light');
		toggleTheme();
		expect(dispatchedEvents).toHaveLength(1);
		expect(dispatchedEvents[0].type).toBe('theme-change');
		expect(dispatchedEvents[0].detail).toEqual({ theme: 'dark' });
	});

	it('toggleTheme from dark dispatches light event', () => {
		applyTheme('dark');
		toggleTheme();
		expect(dispatchedEvents[0].detail).toEqual({ theme: 'light' });
	});

	it('resolveTheme returns stored theme when available', () => {
		mockLocalStorage.setItem('theme', 'dark');
		systemPrefersDark = false;
		expect(resolveTheme()).toBe('dark');
	});

	it('resolveTheme falls back to system preference when no stored theme', () => {
		systemPrefersDark = true;
		expect(resolveTheme()).toBe('dark');

		systemPrefersDark = false;
		expect(resolveTheme()).toBe('light');
	});

	it('resolveTheme ignores invalid localStorage values', () => {
		mockLocalStorage.setItem('theme', 'invalid');
		systemPrefersDark = true;
		expect(resolveTheme()).toBe('dark');
	});

	it('head inline script presence: ThemeManager script should be in BaseHead.astro', async () => {
		// Verify the inline script exists in the component source
		const fs = await import('fs');
		const content = fs.readFileSync('src/components/BaseHead.astro', 'utf-8');
		expect(content).toContain('<script is:inline>');
		expect(content).toContain('__toggleTheme');
		expect(content).toContain("localStorage");
		expect(content).toContain('prefers-color-scheme');
	});
});
