/**
 * Extract the first image reference from MDX body content.
 * Matches patterns like ![alt](./foo.png) for co-located post images.
 */
export function extractFirstBodyImage(body: string | undefined): string | null {
	if (!body) return null;
	// Match markdown image syntax referencing co-located images
	const match = body.match(/!\[.*?\]\(\.\/([^)]+)\)/);
	return match ? `./${match[1]}` : null;
}
