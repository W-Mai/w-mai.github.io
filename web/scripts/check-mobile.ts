/**
 * Check mobile responsiveness patterns in source files.
 * Detects fixed widths, missing responsive variants, oversized gaps,
 * and other patterns that cause issues on narrow screens (<400px).
 * Exit code 1 if violations found.
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const SRC = resolve(import.meta.dir, '../src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.astro']);

interface Violation {
  file: string;
  line: number;
  rule: string;
  match: string;
}

interface Rule {
  name: string;
  test: (line: string, filePath: string) => string | null;
}

// Fixed pixel widths that don't adapt (ignore media queries and max-width constraints)
const FIXED_WIDTH_RE = /(?:^|[^-])(?:width|min-width)\s*:\s*(\d{4,})px/;
const FIXED_W_CLASS_RE = /\bw-\[(\d{4,})px\]/;

// Deep nesting of absolute positioning without responsive override
const ABSOLUTE_NO_RESPONSIVE_RE = /\babsolute\b.*(?:top|left|right|bottom)-\[\d+(?:rem|px)\]/;

const RULES: Rule[] = [
  {
    name: 'Fixed width >= 1000px without responsive variant',
    test: (line) => {
      const m = FIXED_WIDTH_RE.exec(line) || FIXED_W_CLASS_RE.exec(line);
      if (!m) return null;
      const px = parseInt(m[1]);
      if (px < 1000) return null;
      // Allow if line has responsive prefix (sm:, md:, lg:)
      if (/\b(sm|md|lg|xl):/i.test(line)) return null;
      // Allow in style objects (React inline styles are dynamic)
      if (line.includes('style=') || line.includes('style:')) return null;
      return m[0];
    },
  },
  {
    name: 'gap-10 or larger without responsive variant',
    test: (line) => {
      const m = line.match(/\bgap-(\d+)\b/);
      if (!m) return null;
      const val = parseInt(m[1]);
      if (val < 10) return null;
      // Check if there's a responsive gap variant on the same element
      if (/\b(sm|md|lg):gap-/.test(line)) return null;
      return m[0];
    },
  },
  {
    name: 'p-16 or larger without responsive variant',
    test: (line) => {
      const m = line.match(/\b(?:p|px|py)-(\d+)\b/);
      if (!m) return null;
      const val = parseInt(m[1]);
      if (val < 16) return null;
      if (/\b(sm|md|lg):(?:p|px|py)-/.test(line)) return null;
      return m[0];
    },
  },
  {
    name: 'rounded-3xl or larger without responsive variant',
    test: (line) => {
      if (!/\brounded-3xl\b/.test(line)) return null;
      if (/\b(sm|md|lg):rounded-/.test(line)) return null;
      // Allow in CSS files and style blocks
      if (line.trim().startsWith('.') || line.trim().startsWith('/*')) return null;
      return 'rounded-3xl';
    },
  },
  {
    name: 'grid-cols-3+ without single-column or 2-col mobile fallback',
    test: (line) => {
      const m = line.match(/\bgrid-cols-([3-9])\b/);
      if (!m) return null;
      // OK if there's a responsive prefix (this IS a breakpoint-specific value)
      if (new RegExp(`\\b(sm|md|lg|xl):grid-cols-${m[1]}\\b`).test(line)) return null;
      // OK if there's grid-cols-1 or grid-cols-2 on the same line (mobile fallback)
      if (/\bgrid-cols-[12]\b/.test(line)) return null;
      return m[0];
    },
  },
];

// Files/patterns to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /dist\//,
  /editor\/post\//,  // Editor UI is desktop-only
  /editor\/shared\//,
  /__tests__\//,
];

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some(re => re.test(filePath));
}

function isCommentOrImport(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('import ') || t.startsWith('<!--');
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
  const root = resolve(SRC, '..');

  for (const file of files) {
    const relPath = relative(root, file);
    if (shouldSkip(relPath)) continue;

    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isCommentOrImport(line)) continue;

      for (const rule of RULES) {
        const match = rule.test(line, relPath);
        if (match) {
          violations.push({ file: relPath, line: i + 1, rule: rule.name, match });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ No mobile responsiveness issues found.');
    process.exit(0);
  }

  console.error(`❌ Found ${violations.length} mobile responsiveness issue(s):\n`);
  const grouped = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!grouped.has(v.rule)) grouped.set(v.rule, []);
    grouped.get(v.rule)!.push(v);
  }
  for (const [rule, items] of grouped) {
    console.error(`  ${rule}:`);
    for (const v of items) {
      console.error(`    ${v.file}:${v.line}  →  ${v.match}`);
    }
    console.error();
  }
  process.exit(1);
}

main();
