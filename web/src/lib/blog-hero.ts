/**
 * Extract the first image reference from MDX body content.
 * Matches patterns like ![alt](./assets/xxx.png) or heroImage-style refs.
 */
export function extractFirstBodyImage(body: string | undefined): string | null {
	if (!body) return null;
	// Match markdown image syntax referencing local assets
	const match = body.match(/!\[.*?\]\(\.\/(assets\/[^)]+)\)/);
	return match ? `./${match[1]}` : null;
}
