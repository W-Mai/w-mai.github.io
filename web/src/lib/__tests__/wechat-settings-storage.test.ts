import { beforeEach, describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Mock localStorage with an in-memory Map
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

import {
  loadSettings,
  saveSettings,
  clearSettings,
  isValidHexColor,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  type PersistedSettings,
} from '../wechat-templates';

beforeEach(() => {
  store.clear();
});

// --- Generators ---

const hexChars = '0123456789abcdef'.split('');

// Build a hex string of exact length from hex char array
const arbHexOfLength = (len: number) =>
  fc.array(fc.constantFrom(...hexChars), { minLength: len, maxLength: len })
    .map(chars => chars.join(''));

// Valid hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
const arbValidHexColor = fc
  .constantFrom(3, 4, 6, 8)
  .chain(len => arbHexOfLength(len).map(s => '#' + s));

// Invalid hex colors: strings that do NOT match the valid pattern
const arbInvalidHexColor = fc.oneof(
  // Missing # prefix (bare hex digits)
  arbHexOfLength(6),
  // Wrong length hex digits (1, 2, 5, 7, 9+)
  fc.constantFrom(1, 2, 5, 7, 9, 10).chain(len =>
    arbHexOfLength(len).map(s => '#' + s),
  ),
  // Non-hex characters after #
  fc.constantFrom(3, 6).chain(len =>
    fc.array(
      fc.constantFrom(...'ghijklmnopqrstuvwxyz!@$%^&*'.split('')),
      { minLength: len, maxLength: len },
    ).map(chars => '#' + chars.join('')),
  ),
  // Empty string and just #
  fc.constantFrom('', '#'),
);

// Valid PersistedSettings generator
const arbPersistedSettings: fc.Arbitrary<PersistedSettings> = fc.record({
  fontFamilyId: fc.option(
    fc.constantFrom(...FONT_FAMILY_OPTIONS.map(o => o.id)),
    { nil: undefined },
  ),
  fontSize: fc.option(
    fc.constantFrom(...FONT_SIZE_OPTIONS),
    { nil: undefined },
  ),
  themeColor: fc.option(
    fc.constantFrom(3, 6).chain(len =>
      arbHexOfLength(len).map(s => '#' + s),
    ),
    { nil: undefined },
  ),
  textIndent: fc.option(fc.boolean(), { nil: undefined }),
});

// Feature: wechat-export-settings, Property 5: Invalid hex color rejection
// **Validates: Requirements 3.6**
describe('Property 5: Invalid hex color rejection', () => {
  it('valid hex colors (3, 4, 6, 8 digit with #) return true', () => {
    fc.assert(
      fc.property(arbValidHexColor, (color) => {
        expect(isValidHexColor(color)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('invalid hex color strings return false', () => {
    fc.assert(
      fc.property(arbInvalidHexColor, (color) => {
        expect(isValidHexColor(color)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: wechat-export-settings, Property 8: Settings persistence round-trip
// **Validates: Requirements 5.1, 5.2**
describe('Property 8: Settings persistence round-trip', () => {
  it('saveSettings then loadSettings returns equivalent PersistedSettings', () => {
    fc.assert(
      fc.property(arbPersistedSettings, (settings) => {
        store.clear();
        saveSettings(settings);
        const loaded = loadSettings();

        // Compare each field — undefined fields should remain undefined
        expect(loaded.fontFamilyId).toBe(settings.fontFamilyId);
        expect(loaded.fontSize).toBe(settings.fontSize);
        expect(loaded.themeColor).toBe(settings.themeColor);
        expect(loaded.textIndent).toBe(settings.textIndent);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: wechat-export-settings, Property 9: Reset clears all settings to defaults
// **Validates: Requirements 6.2, 6.3**
describe('Property 9: Reset clears all settings to defaults', () => {
  it('clearSettings then loadSettings returns default empty object', () => {
    fc.assert(
      fc.property(arbPersistedSettings, (settings) => {
        store.clear();
        saveSettings(settings);
        clearSettings();
        const loaded = loadSettings();

        // All fields should be undefined after reset
        expect(loaded.fontFamilyId).toBeUndefined();
        expect(loaded.fontSize).toBeUndefined();
        expect(loaded.themeColor).toBeUndefined();
        expect(loaded.textIndent).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });
});
