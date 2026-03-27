import type { CdnAdapter } from './adapter';
import { R2Adapter } from './r2-adapter';
import { LocalAdapter } from './local-adapter';

export interface CdnConfig {
	/** Active adapter instance. */
	adapter: CdnAdapter;
	/** Fallback adapter (used by client-side onerror). */
	fallbackAdapter: CdnAdapter;
	/** Placeholder image URL for missing images. */
	placeholderUrl: string;
}

const localAdapter = new LocalAdapter({ basePath: '/' });

function createAdapter(): CdnAdapter {
	const endpoint = import.meta.env.CDN_ENDPOINT || process.env.CDN_ENDPOINT;
	const bucket = import.meta.env.CDN_BUCKET || process.env.CDN_BUCKET;
	if (endpoint && bucket) {
		return new R2Adapter({ endpoint, bucket });
	}
	return localAdapter;
}

export const cdnConfig: CdnConfig = {
	adapter: createAdapter(),
	fallbackAdapter: localAdapter,
	placeholderUrl: '/images/placeholder.svg',
};
