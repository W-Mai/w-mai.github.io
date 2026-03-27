import type { CdnAdapter } from './adapter';

export interface LocalAdapterConfig {
	/** Base path for local images, e.g. "/" or "/assets/". */
	basePath: string;
}

export class LocalAdapter implements CdnAdapter {
	readonly name = 'local';

	constructor(private config: LocalAdapterConfig) {}

	resolveUrl(imageId: string, _variant?: string): string {
		const base = this.config.basePath.replace(/\/$/, '');
		return `${base}/${imageId}`;
	}
}
