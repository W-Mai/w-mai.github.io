import { cdnConfig } from './cdn-config';

/** Minimal image source descriptor for URL resolution. */
export interface ImageSource {
	id: string;
	source: 'cdn' | 'local';
}

/**
 * Resolve an image entry to a CDN or local URL.
 * CDN-sourced images use the primary adapter; local-sourced use fallback.
 */
export function resolveImageUrl(image: ImageSource, variant?: string): string {
	if (image.source === 'cdn') {
		return cdnConfig.adapter.resolveUrl(image.id, variant);
	}
	return cdnConfig.fallbackAdapter.resolveUrl(image.id, variant);
}

/**
 * Resolve by raw image ID (for use outside registry context).
 * Returns placeholder and warns if the ID is not in the registry.
 */
export function resolveImageUrlById(
	imageId: string,
	variant?: string,
	registry?: Map<string, ImageSource>,
): string {
	if (registry && !registry.has(imageId)) {
		console.warn(`[cdn] Image not found in registry: ${imageId}`);
		return cdnConfig.placeholderUrl;
	}
	return cdnConfig.adapter.resolveUrl(imageId, variant);
}

/** Generate fallback URL for client-side onerror. */
export function resolveFallbackUrl(imageId: string): string {
	return cdnConfig.fallbackAdapter.resolveUrl(imageId);
}
