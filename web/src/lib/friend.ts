/**
 * Friend links utility functions.
 * Pure helpers for avatar detection and fallback character generation.
 */

/** Check whether the avatar string is a valid non-empty value. */
export function hasAvatar(avatar: string): boolean {
	return avatar.trim().length > 0;
}

/** Return the first character of `name` as a fallback avatar character. */
export function getFallbackChar(name: string): string {
	return name.charAt(0);
}
