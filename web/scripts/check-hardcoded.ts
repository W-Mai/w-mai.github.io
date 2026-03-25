/**
 * Check for hardcoded strings that should use constants from ~/consts.
 * Scans src/ for domain names, usernames, site titles, etc. that
 * should be referenced via SITE_URL, USER_NAME, NICK_NAME, etc.
 * Exit code 1 if violations found.
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import {
  USER_NAME, NICK_NAME, SITE_URL, SITE_DOMAIN,
} from '../src/consts';

const SRC = resolve(import.meta.dir, '../src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.mjs']);

interface Rule {
  name: string;
  pattern: RegExp;
  allowedFiles: RegExp[];
}

// Build rules from actual constant values
const RULES: Rule[] = [
  {
    name: `Hardcoded domain "${SITE_DOMAIN}"`,
    pattern: new RegExp(`(?<![\\w/])${SITE_DOMAIN.replace(/\./g, '\\.')}(?![\\w])`, 'g'),
    allowedFiles: [/consts\.ts$/, /astro\.config/],
  },
  {
    name: `Hardcoded URL "${SITE_URL}"`,
    pattern: new RegExp(SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    allowedFiles: [/consts\.ts$/, /astro\.config/],
  },
  {
    name: `Hardcoded username "${USER_NAME}" (not in import/const)`,
    pattern: new RegExp(`(?<![\\w@/])${USER_NAME}(?![\\w])`, 'g'),
    allowedFiles: [/consts\.ts$/, /github\.ts$/],
  },
  {
    name: `Hardcoded nickname "${NICK_NAME}" (not in import/const)`,
    pattern: new RegExp(NICK_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    allowedFiles: [/consts\.ts$/],
  },
  {
    name: 'Hardcoded github avatar URL',
    pattern: /github\.com\/[\w-]+\.png/g,
    allowedFiles: [/consts\.ts$/],
  },
];

interface Violation {
  file: string;
  line: number;
  rule: string;
  match: string;
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

function isImportOrConstLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('import ') || trimmed.startsWith('export const ') || trimmed.startsWith('const ');
}

async function main() {
  const files = await collectFiles(SRC);
  const violations: Violation[] = [];
  const root = resolve(SRC, '..');

  for (const file of files) {
    const relPath = relative(root, file);
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    for (const rule of RULES) {
      if (rule.allowedFiles.some(re => re.test(relPath))) continue;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isImportOrConstLine(line)) continue;
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        rule.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = rule.pattern.exec(line)) !== null) {
          violations.push({
            file: relPath,
            line: i + 1,
            rule: rule.name,
            match: match[0],
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ No hardcoded strings found. All values use constants from ~/consts.');
    process.exit(0);
  }

  console.error(`❌ Found ${violations.length} hardcoded string(s). Use constants from ~/consts instead:\n`);
  const grouped = new Map<string, Violation[]>();
  for (const v of violations) {
    const key = v.rule;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(v);
  }
  for (const [rule, items] of grouped) {
    console.error(`  ${rule}:`);
    for (const v of items) {
      console.error(`    ${v.file}:${v.line}  →  "${v.match}"`);
    }
    console.error();
  }
  process.exit(1);
}

main();
