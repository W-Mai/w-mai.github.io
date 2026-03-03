const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Validate that a slug contains only safe characters */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
