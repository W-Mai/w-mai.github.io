import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  validateSlug,
  validatePostSlug,
  validateAssetName,
  normalizeAssetName,
  deduplicateAssetName,
  persistEditorState,
  restoreEditorState,
} from '../editor/utils';

// --- Legacy validateSlug tests ---

describe('validateSlug', () => {
  it('accepts valid slugs', () => {
    expect(validateSlug('hello-world')).toBe(true);
    expect(validateSlug('my_post')).toBe(true);
    expect(validateSlug('post123')).toBe(true);
    expect(validateSlug('A-Z_test')).toBe(true);
  });

  it('rejects path traversal patterns', () => {
    expect(validateSlug('..')).toBe(false);
    expect(validateSlug('../etc')).toBe(false);
    expect(validateSlug('foo/bar')).toBe(false);
    expect(validateSlug('foo\\bar')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateSlug('')).toBe(false);
  });

  it('rejects slugs with special characters', () => {
    expect(validateSlug('hello world')).toBe(false);
    expect(validateSlug('hello.world')).toBe(false);
    expect(validateSlug('hello@world')).toBe(false);
  });
});

// --- Property-based tests ---

const POST_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ASSET_NAME_RE = /^[a-z0-9_-]+\.[a-z0-9]+$/;

// Arbitrary: valid slug segment (lowercase alphanumeric, 1-10 chars)
const arbSlugSegment = fc.stringMatching(/^[a-z0-9]{1,10}$/);

// Arbitrary: valid post slug (segments joined by hyphens)
const arbValidSlug = fc
  .array(arbSlugSegment, { minLength: 1, maxLength: 6 })
  .map((parts) => parts.join('-'));

// Arbitrary: valid asset base name
const arbAssetBase = fc.stringMatching(/^[a-z0-9_-]{1,20}$/);

// Arbitrary: valid asset extension
const arbAssetExt = fc.stringMatching(/^[a-z0-9]{1,5}$/);

// Arbitrary: valid asset name
const arbValidAssetName = fc
  .tuple(arbAssetBase, arbAssetExt)
  .map(([base, ext]) => `${base}.${ext}`);

// Feature: editor-enhancement, Property 1: Slug validation correctness
describe('Property 1: Slug validation correctness', () => {
  it('valid slugs are accepted', () => {
    fc.assert(
      fc.property(arbValidSlug, (slug) => {
        if (slug.length > 80) return true;
        const result = validatePostSlug(slug);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });

  it('random strings match regex iff validatePostSlug returns valid', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (input) => {
        const result = validatePostSlug(input);
        const expected = POST_SLUG_RE.test(input) && input.length <= 80;
        expect(result.valid).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('invalid slugs always have a non-empty error message', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (input) => {
        const result = validatePostSlug(input);
        if (!result.valid) {
          expect(result.error).toBeTruthy();
        }
      }),
      { numRuns: 200 },
    );
  });

  it('rejects slugs longer than 80 characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9]{81,120}$/),
        (longSlug) => {
          const result = validatePostSlug(longSlug);
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-enhancement, Property 2: Asset name validation correctness
describe('Property 2: Asset name validation correctness', () => {
  it('random strings match regex iff validateAssetName returns true', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 80 }), (input) => {
        const result = validateAssetName(input);
        const expected = ASSET_NAME_RE.test(input);
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('valid asset names are accepted', () => {
    fc.assert(
      fc.property(arbValidAssetName, (name) => {
        expect(validateAssetName(name)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: editor-enhancement, Property 3: Asset name normalization produces valid names
describe('Property 3: Asset name normalization produces valid names', () => {
  it('normalized names with extension pass validation', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 40 }), arbAssetExt, (base, ext) => {
        const input = `${base}.${ext}`;
        const normalized = normalizeAssetName(input);
        // Normalized name should be valid if the base part is non-empty after normalization
        const parts = normalized.split('.');
        if (parts.length >= 2 && parts[0].length > 0) {
          expect(validateAssetName(normalized)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('normalization is idempotent (applying twice yields same result)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 40 }), arbAssetExt, (base, ext) => {
        const input = `${base}.${ext}`;
        const once = normalizeAssetName(input);
        const twice = normalizeAssetName(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: editor-enhancement, Property 4: Asset name deduplication avoids conflicts
describe('Property 4: Asset name deduplication avoids conflicts', () => {
  it('result is never in the existing names set', () => {
    fc.assert(
      fc.property(arbValidAssetName, fc.array(arbValidAssetName, { maxLength: 20 }), (name, existing) => {
        const existingSet = new Set(existing);
        const result = deduplicateAssetName(name, existingSet);
        expect(existingSet.has(result)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('returns original name when no conflict', () => {
    fc.assert(
      fc.property(arbValidAssetName, (name) => {
        const result = deduplicateAssetName(name, new Set());
        expect(result).toBe(name);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: editor-enhancement, Property 12: Editor state persistence round-trip
describe('Property 12: Editor state persistence round-trip', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  it('selectedSlug round-trips correctly', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 80 }), (slug) => {
        persistEditorState('selectedSlug', slug);
        expect(restoreEditorState('selectedSlug')).toBe(slug);
      }),
      { numRuns: 100 },
    );
  });

  it('sidebarTab round-trips correctly', () => {
    fc.assert(
      fc.property(fc.constantFrom('posts', 'assets'), (tab) => {
        persistEditorState('sidebarTab', tab);
        expect(restoreEditorState('sidebarTab')).toBe(tab);
      }),
      { numRuns: 100 },
    );
  });
});
