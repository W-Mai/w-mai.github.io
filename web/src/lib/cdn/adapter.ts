/** Uniform interface for all CDN provider implementations. */
export interface CdnAdapter {
	/** Provider name for logging and debugging. */
	readonly name: string;
	/** Resolve a logical image id + optional variant to a full URL. */
	resolveUrl(imageId: string, variant?: string): string;
}
