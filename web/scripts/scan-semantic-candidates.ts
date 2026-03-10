#!/usr/bin/env bun
/**
 * Scan .astro/.tsx files for Tailwind class patterns that match
 * semantic CSS classes defined in neumorphism.css and components.css.
 *
 * Detects:
 * 1. neu-section-title pattern: flex + items-center + gap-2 + font-bold + text-heading
 * 2. neu-section-divider pattern: h-0.5 + flex-1 + bg-border-subtle + rounded-full
 * 3. neu-stat-cell pattern: neu-inset + rounded-xl + text-center (without .neu-stat-cell)
 * 4. neu-info-card pattern: neu-card + flex + items-center + gap (without .neu-info-card)
 * 5. neu-board pattern: neu-inset + rounded-[2rem] (without .neu-board)
 * 6. neu-filter-btn pattern: px-3 + py-1.5 + rounded-xl + text-xs + text-link + transition-all (without .neu-filter-btn)
 * 7. page-title pattern: font-bold + text-4xl (without .page-title)
 * 8. page-subtitle pattern: text-lg + text-secondary + mb (without .page-subtitle)
 * 9. stat-value pattern: font-bold + text-xl + text-heading (without .stat-value)
 * 10. stat-label pattern: text-[11px] + text-muted (without .stat-label)
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const SRC_DIR = join(import.meta.dir, '..', 'src')
const EXTENSIONS = ['.astro', '.tsx', '.jsx']

// Recursively collect files
function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.astro' || entry === 'dist') continue
      results.push(...collectFiles(full, exts))
    } else if (exts.some(e => full.endsWith(e))) {
      results.push(full)
    }
  }
  return results
}

interface Finding {
  file: string
  line: number
  semantic: string
  classStr: string
}

const findings: Finding[] = []

// Pattern detectors: each checks a class string and returns semantic class name if matched
const detectors: { name: string; test: (cls: string, fullLine: string) => boolean }[] = [
  {
    name: 'neu-section-title',
    test: (cls) =>
      !cls.includes('neu-section-title') &&
      cls.includes('flex') &&
      cls.includes('items-center') &&
      cls.includes('gap-') &&
      cls.includes('font-bold') &&
      (cls.includes('text-heading') || cls.includes('--text-heading')),
  },
  {
    name: 'neu-section-divider',
    test: (cls) =>
      !cls.includes('neu-section-divider') &&
      cls.includes('h-0.5') &&
      cls.includes('flex-1') &&
      (cls.includes('border-subtle') || cls.includes('--border-subtle')) &&
      cls.includes('rounded-full'),
  },
  {
    name: 'neu-filter-btn',
    test: (cls) =>
      !cls.includes('neu-filter-btn') &&
      (cls.includes('neu-btn') || cls.includes('neu-inset')) &&
      /px-3/.test(cls) &&
      /py-1\.5/.test(cls) &&
      cls.includes('rounded-xl') &&
      (cls.includes('text-link') || cls.includes('--text-link')),
  },
  {
    name: 'neu-stat-cell',
    test: (cls) =>
      !cls.includes('neu-stat-cell') &&
      cls.includes('neu-inset') &&
      cls.includes('rounded-xl') &&
      cls.includes('text-center') &&
      /px-[34]/.test(cls) &&
      /py-[34]/.test(cls),
  },
  {
    name: 'neu-info-card',
    test: (cls) =>
      !cls.includes('neu-info-card') &&
      cls.includes('neu-card') &&
      cls.includes('flex') &&
      cls.includes('items-center') &&
      /gap-2\.5|gap-3/.test(cls) &&
      cls.includes('rounded-xl'),
  },
  {
    name: 'neu-board',
    test: (cls) =>
      !cls.includes('neu-board') &&
      cls.includes('neu-inset') &&
      cls.includes('rounded-[2rem]'),
  },
  {
    name: 'page-title',
    test: (cls) =>
      !cls.includes('page-title') &&
      cls.includes('font-bold') &&
      cls.includes('text-4xl') &&
      /md:text-6xl/.test(cls) &&
      /mb-4/.test(cls),
  },
  {
    name: 'page-subtitle',
    test: (cls) =>
      !cls.includes('page-subtitle') &&
      cls.includes('text-lg') &&
      (cls.includes('text-secondary') || cls.includes('--text-secondary')) &&
      /mb-[68]/.test(cls),
  },
  {
    name: 'stat-value',
    test: (cls) =>
      !cls.includes('stat-value') &&
      cls.includes('block') &&
      cls.includes('font-bold') &&
      /text-xl\b/.test(cls) &&
      /sm:text-2xl/.test(cls) &&
      (cls.includes('text-heading') || cls.includes('--text-heading')),
  },
  {
    name: 'stat-label',
    test: (cls) =>
      !cls.includes('stat-label') &&
      cls.includes('text-[11px]') &&
      /sm:text-xs/.test(cls) &&
      (cls.includes('text-muted') || cls.includes('--text-muted')),
  },
]

const files = collectFiles(SRC_DIR, EXTENSIONS)

// Extract class attributes from template content
const CLASS_RE = /class[=:](?:\{[`"]([^`"]*)[`"]\}|"([^"]*)"|'([^']*)'|`([^`]*)`)/g

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let match: RegExpExecArray | null
    CLASS_RE.lastIndex = 0

    while ((match = CLASS_RE.exec(line)) !== null) {
      const classStr = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''
      if (!classStr.trim()) continue

      for (const det of detectors) {
        if (det.test(classStr, line)) {
          findings.push({
            file: relative(join(import.meta.dir, '..'), file),
            line: i + 1,
            semantic: det.name,
            classStr: classStr.length > 80 ? classStr.slice(0, 80) + '...' : classStr,
          })
        }
      }
    }
  }
}

// Report
if (findings.length === 0) {
  console.log('✅ No unreplaced semantic class candidates found.')
} else {
  console.log(`⚠️  Found ${findings.length} unreplaced pattern(s):\n`)
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}`)
    console.log(`    → should use: .${f.semantic}`)
    console.log(`    class: "${f.classStr}"`)
    console.log()
  }
}
