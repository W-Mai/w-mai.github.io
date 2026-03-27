import type { CdnAdapter } from './adapter';

export interface R2AdapterConfig {
	/** Custom domain or R2 public endpoint, e.g. "https://cdn.example.com" */
	endpoint: string;
	/** R2 bucket name, used as path prefix when no custom domain. */
	bucket: string;
	/** Optional path prefix within the bucket. */
	pathPrefix?: string;
}

export class R2Adapter implements CdnAdapter {
	readonly name = 'cloudflare-r2';

	constructor(private config: R2AdapterConfig) {}

	resolveUrl(imageId: string, variant?: string): string {
		const base = this.config.endpoint.replace(/\/$/, '');
		const prefix = this.config.pathPrefix ? `/${this.config.pathPrefix}` : '';
		const variantSuffix = variant ? `/${variant}` : '';
		return `${base}${prefix}/${imageId}${variantSuffix}`;
	}
}
