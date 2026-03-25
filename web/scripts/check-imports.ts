/**
 * Check that no deep relative imports (../../ or deeper) exist in src/.
 * All cross-directory imports should use the ~/ alias.
 * Exit code 1 if violations found.
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const SRC = resolve(import.meta.dir, '../src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.mjs']);

// Match static and dynamic imports with ../../ or deeper
const DEEP_RELATIVE_RE = /(?:from\s+['"]|import\s*\(\s*['"])(\.\.\/\.\.\/[^'"]*)['"]/g;

// Allowlist: import.meta.glob patterns are not real imports
const GLOB_LINE_RE = /import\.meta\.glob/;

interface Violation {
  file: string;
  line: number;
  path: string;
}

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...await collectFiles(full));
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await collectFiles(SRC);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (GLOB_LINE_RE.test(line)) continue;

      let match: RegExpExecArray | null;
      DEEP_RELATIVE_RE.lastIndex = 0;
      while ((match = DEEP_RELATIVE_RE.exec(line)) !== null) {
        violations.push({
          file: relative(resolve(SRC, '..'), file),
          line: i + 1,
          path: match[1],
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ No deep relative imports found. All imports use ~/ correctly.');
    process.exit(0);
  }

  console.error(`❌ Found ${violations.length} deep relative import(s). Use ~/ alias instead:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.path}`);
  }
  console.error('\nRun: replace ../../+ paths with ~/lib/..., ~/components/..., etc.');
  process.exit(1);
}

main();
