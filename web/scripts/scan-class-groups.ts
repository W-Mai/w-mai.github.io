#!/usr/bin/env bun
/**
 * Group identical or near-identical class strings across components.
 * Helps identify which patterns appear multiple times and are worth extracting.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const SRC_DIR = join(import.meta.dir, '..', 'src')
const EXTENSIONS = ['.astro', '.tsx', '.jsx']
const MIN_TOKENS = 6

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.astro' || entry === 'dist' || entry === '__tests__') continue
      results.push(...collectFiles(full, exts))
    } else if (exts.some(e => full.endsWith(e))) {
      results.push(full)
    }
  }
  return results
}

const CLASS_RE = /class(?:Name)?[=:](?:\{[`"]([^`"]*)[`"]\}|"([^"]*)"|'([^']*)'|`([^`]*)`)/g

const SEMANTIC = new Set([
  'neu-bg', 'neu-card', 'neu-card-warm', 'neu-btn', 'neu-inset', 'neu-avatar-ring',
  'neu-section-title', 'neu-section-divider', 'neu-stat-cell', 'neu-info-card',
  'neu-board', 'neu-filter-btn', 'neu-card-section', 'neu-freq-card',
  'page-title', 'page-subtitle', 'stat-value', 'stat-label',
  'card-cover-img', 'info-card-value',
  'anim-fade', 'anim-zoom', 'sr-only',
])

// Normalize: sort tokens, remove dynamic parts
function normalize(cls: string): string {
  return cls
    .split(/\s+/)
    .filter(t => t && !t.includes('${') && !SEMANTIC.has(t))
    .sort()
    .join(' ')
}

const groups = new Map<string, { file: string; line: number; raw: string }[]>()
const files = collectFiles(SRC_DIR, EXTENSIONS)

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  let inScript = false, inStyle = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/<script\b/.test(line)) inScript = true
    if (/<\/script>/.test(line)) { inScript = false; continue }
    if (/<style\b/.test(line)) inStyle = true
    if (/<\/style>/.test(line)) { inStyle = false; continue }
    if (inScript || inStyle) continue

    let match: RegExpExecArray | null
    CLASS_RE.lastIndex = 0
    while ((match = CLASS_RE.exec(line)) !== null) {
      const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim()
      if (!raw) continue
      const tokens = raw.split(/\s+/).filter(t => t && !SEMANTIC.has(t))
      if (tokens.length < MIN_TOKENS) continue

      const key = normalize(raw)
      const list = groups.get(key) ?? []
      list.push({ file: relative(join(import.meta.dir, '..'), file), line: i + 1, raw })
      groups.set(key, list)
    }
  }
}

// Show groups with 2+ occurrences first, then singles
const multi = [...groups.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)
const singles = [...groups.entries()].filter(([, v]) => v.length === 1).sort((a, b) => b[0].split(' ').length - a[0].split(' ').length)

console.log(`=== DUPLICATED PATTERNS (${multi.length} groups, worth extracting) ===\n`)
for (const [key, locs] of multi) {
  console.log(`  [${locs.length}x] "${key.length > 90 ? key.slice(0, 90) + '...' : key}"`)
  for (const loc of locs) {
    console.log(`      ${loc.file}:${loc.line}`)
  }
  console.log()
}

console.log(`\n=== UNIQUE PATTERNS (${singles.length} items, lower priority) ===\n`)
for (const [key, locs] of singles) {
  const tokens = key.split(' ').length
  console.log(`  [${tokens} tokens] ${locs[0].file}:${locs[0].line}`)
  console.log(`    "${key.length > 90 ? key.slice(0, 90) + '...' : key}"`)
  console.log()
}
