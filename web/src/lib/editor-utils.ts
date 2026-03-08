// --- Legacy slug validation (kept for backward compatibility) ---

const LEGACY_SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Validate that a slug contains only safe characters */
export function validateSlug(slug: string): boolean {
  return LEGACY_SLUG_PATTERN.test(slug);
}

// --- Strict post slug validation ---

const POST_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

/** Validate a post slug against strict naming convention */
export function validatePostSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) return { valid: false, error: 'Slug is required' };
  if (slug.length > MAX_SLUG_LENGTH)
    return { valid: false, error: `Slug must be ${MAX_SLUG_LENGTH} characters or less` };
  if (!POST_SLUG_PATTERN.test(slug))
    return {
      valid: false,
      error:
        'Slug must contain only lowercase letters, digits, and hyphens (no leading/trailing/consecutive hyphens)',
    };
  return { valid: true };
}

// --- Asset name validation and normalization ---

const ASSET_PATTERN = /^[a-z0-9_-]+\.[a-z0-9]+$/;

/** Check whether an asset filename matches the naming convention */
export function validateAssetName(name: string): boolean {
  return ASSET_PATTERN.test(name);
}

/** Normalize a filename to match the asset naming convention */
export function normalizeAssetName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) {
    const result = name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');
    return result || 'file';
  }

  const base = name.slice(0, lastDot);
  const ext = name.slice(lastDot + 1);

  const normalized = base
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return `${normalized || 'file'}.${ext.toLowerCase()}`;
}

/** Append numeric suffix to avoid name conflicts */
export function deduplicateAssetName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name;
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : '';
  let i = 1;
  while (existingNames.has(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
}

// --- Reference counting ---

// Asset reference patterns
const ASSET_PATTERNS = [
  /!\[.*?\]\(\.?\/?\/?assets\/([^)]+)\)/g,           // ![alt](./assets/foo.png)
  /import\s+.*?\s+from\s+['"]\.?\/?\/?assets\/([^'"]+)['"]/g, // import x from './assets/foo.png'
  /:\s*['"]?\.?\/?\/?assets\/([^'"\s\n]+)['"]?/g,    // heroImage: ./assets/foo.png
  /['"]@posts\/assets\/([^'"]+)['"]/g,                // '@posts/assets/foo.png'
];

/** Scan posts and src files for asset references */
export async function computeAssetReferences(
  postsDir: string,
  assetNames: string[],
): Promise<Map<string, string[]>> {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');

  const refs = new Map<string, string[]>(assetNames.map((n) => [n, []]));
  const srcDir = resolve(postsDir, '..', 'web', 'src');

  // Collect all scannable files: .mdx posts + src code files
  const scanFiles: { path: string; label: string }[] = [];

  try {
    for (const f of await readdir(postsDir)) {
      if (f.endsWith('.mdx')) scanFiles.push({ path: join(postsDir, f), label: f.replace(/\.mdx$/, '') });
    }
  } catch { /* empty */ }

  try {
    const { glob } = await import('node:fs/promises');
    for await (const f of glob('**/*.{astro,ts,tsx,js,jsx}', { cwd: srcDir })) {
      if (!f.includes('node_modules')) {
        scanFiles.push({ path: join(srcDir, f), label: `[src] ${f.replace(/\.[^.]+$/, '')}` });
      }
    }
  } catch { /* empty */ }

  for (const { path, label } of scanFiles) {
    let content: string;
    try { content = await readFile(path, 'utf-8'); } catch { continue; }

    const found = new Set<string>();
    for (const re of ASSET_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) found.add(m[1]);
    }

    for (const name of found) {
      refs.get(name)?.push(label);
    }
  }

  return refs;
}

// --- Editor state persistence ---

const STORAGE_KEYS = {
  selectedSlug: 'editor:selectedSlug',
  sidebarTab: 'editor:sidebarTab',
} as const;

/** Persist an editor state value to localStorage */
export function persistEditorState(key: keyof typeof STORAGE_KEYS, value: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS[key], value);
  } catch {}
}

/** Restore an editor state value from localStorage */
export function restoreEditorState(key: keyof typeof STORAGE_KEYS): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS[key]);
  } catch {
    return null;
  }
}
