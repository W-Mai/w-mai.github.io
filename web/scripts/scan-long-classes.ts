#!/usr/bin/env bun
/**
 * Scan .astro/.tsx files for class attributes with many Tailwind utilities.
 * Reports classes with 6+ utility tokens that could be extracted into semantic CSS classes.
 * Groups duplicates to identify high-frequency patterns worth extracting.
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

interface ClassOccurrence {
  file: string
  line: number
  classStr: string
  tokenCount: number
}

const occurrences: ClassOccurrence[] = []
const files = collectFiles(SRC_DIR, EXTENSIONS)

// Match class="..." and class={`...`} patterns
const CLASS_RE = /class(?:Name)?[=:](?:\{[`"]([^`"]*)[`"]\}|"([^"]*)"|'([^']*)'|`([^`]*)`)/g

// Tokens that are semantic classes (already extracted) — skip these
const SEMANTIC = new Set([
  'neu-bg', 'neu-card', 'neu-card-warm', 'neu-btn', 'neu-inset', 'neu-avatar-ring',
  'neu-section-title', 'neu-section-divider', 'neu-stat-cell', 'neu-info-card',
  'neu-board', 'neu-filter-btn', 'neu-card-section', 'neu-freq-card',
  'page-title', 'page-subtitle', 'stat-value', 'stat-label',
  'card-cover-img', 'info-card-value',
  'anim-fade', 'anim-zoom', 'sr-only',
])

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n')

  // Skip <script> and <style> blocks
  let inScript = false
  let inStyle = false

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
      const classStr = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim()
      if (!classStr) continue

      // Count non-semantic Tailwind tokens
      const tokens = classStr.split(/\s+/).filter(t => t && !SEMANTIC.has(t))
      if (tokens.length >= MIN_TOKENS) {
        occurrences.push({
          file: relative(join(import.meta.dir, '..'), file),
          line: i + 1,
          classStr,
          tokenCount: tokens.length,
        })
      }
    }
  }
}

// Sort by token count descending
occurrences.sort((a, b) => b.tokenCount - a.tokenCount)

if (occurrences.length === 0) {
  console.log('✅ No long class strings found.')
} else {
  console.log(`Found ${occurrences.length} long class string(s) (${MIN_TOKENS}+ tokens):\n`)
  for (const o of occurrences) {
    const display = o.classStr.length > 100 ? o.classStr.slice(0, 100) + '...' : o.classStr
    console.log(`  ${o.file}:${o.line} (${o.tokenCount} tokens)`)
    console.log(`    "${display}"`)
    console.log()
  }
}
