// Gallery image data — loaded from YAML files in gallery/ directory.
// Each YAML file can contain multiple image entries keyed by imageId.

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { galleryImageSchema } from './schemas';

export interface ImageVariant {
	name: string;
	width: number;
	height: number;
	format?: 'webp' | 'avif' | 'jpg' | 'png' | 'gif';
}

export interface GalleryImage {
	id: string;
	alt: string;
	width: number;
	height: number;
	format: 'webp' | 'avif' | 'jpg' | 'png' | 'gif';
	variants: ImageVariant[];
	album?: string;
	tags?: string[];
	title?: string;
	source: 'cdn' | 'local';
	takenAt?: string;
}

const galleryDir = resolve(process.cwd(), '..', 'gallery');

/** Load all gallery images from YAML files, flattening multi-entry files. */
export async function loadGalleryImages(): Promise<GalleryImage[]> {
	let files: string[];
	try {
		files = (await readdir(galleryDir)).filter((f) => f.endsWith('.yaml'));
	} catch {
		return [];
	}

	const images: GalleryImage[] = [];
	for (const file of files) {
		try {
			const raw = await readFile(resolve(galleryDir, file), 'utf-8');
			const data = parse(raw);
			if (typeof data !== 'object' || data === null) continue;

			for (const [key, value] of Object.entries(data)) {
				const result = galleryImageSchema.safeParse(value);
				if (result.success) {
					images.push({ id: key, ...result.data });
				} else {
					console.warn(`[gallery] Invalid entry "${key}" in ${file}`);
				}
			}
		} catch {
			console.warn(`[gallery] Failed to read: ${file}`);
		}
	}

	return images;
}
