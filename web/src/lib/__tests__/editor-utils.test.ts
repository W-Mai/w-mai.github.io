import { describe, it, expect } from 'vitest';
import { validateSlug } from '../editor-utils';

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
