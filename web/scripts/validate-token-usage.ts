#!/usr/bin/env bun
/**
 * Token usage validator.
 * Scans CSS files for var(--*) references and verifies each
 * referenced custom property is defined in tokens.css.
 */

import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { parseTokenBlock } from './validate-tokens'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TokenUsageViolation {
  file: string
  line: number
  property: string
}

// ── Core function ──────────────────────────────────────────────────────────

/**
 * Scan all .css files in `stylesDir` for `var(--*)` references.
 * Returns violations for any referenced property not in `definedTokens`.
 *
 * - Ignores references inside CSS comments
 * - Handles `var(--prop, fallback)` — extracts just the property name
 * - Skips self-referential definitions in tokens.css (e.g. `--foo: var(--foo)`)
 */
export function scanTokenUsage(
  stylesDir: string,
  definedTokens: Set<string>,
): TokenUsageViolation[] {
  const violations: TokenUsageViolation[] = []
  const cssFiles = readdirSync(stylesDir).filter(f => f.endsWith('.css'))

  for (const file of cssFiles) {
    const filePath = join(stylesDir, file)
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const isTokensFile = basename(file) === 'tokens.css'
    const stripped = stripComments(content)
    const lines = stripped.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip self-referential definitions in tokens.css
      if (isTokensFile) {
        const defMatch = line.match(/^\s*(--[\w-]+)\s*:/)
        if (defMatch) {
          const defName = defMatch[1]
          const refs = extractVarReferences(line)
          for (const ref of refs) {
            if (ref === defName) continue
            if (!definedTokens.has(ref)) {
              violations.push({ file: filePath, line: i + 1, property: ref })
            }
          }
          continue
        }
      }

      const refs = extractVarReferences(line)
      for (const ref of refs) {
        if (!definedTokens.has(ref)) {
          violations.push({ file: filePath, line: i + 1, property: ref })
        }
      }
    }
  }

  return violations
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Strip block comments from CSS content, preserving line count. */
function stripComments(css: string): string {
  // Replace comment content with spaces, keeping newlines intact
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, ' '),
  )
}

/**
 * Extract custom property names from var() calls in a single line.
 * Skips references that have a fallback value (e.g. `var(--prop, fallback)`)
 * since those are intentionally used without a global token definition.
 */
function extractVarReferences(line: string): string[] {
  const refs: string[] = []
  const re = /var\(\s*(--[\w-]+)\s*([,)])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    // Skip if followed by comma — has a fallback value
    if (m[2] === ',') continue
    refs.push(m[1])
  }
  return refs
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (import.meta.main) {
  const tokensPath = join(import.meta.dir, '..', 'src', 'styles', 'tokens.css')
  const stylesDir = join(import.meta.dir, '..', 'src', 'styles')

  let cssContent: string
  try {
    cssContent = readFileSync(tokensPath, 'utf-8')
  } catch {
    console.error(`Error: cannot read ${tokensPath}`)
    process.exit(1)
  }

  // Combine :root and html.dark token sets as the defined set
  const rootTokens = parseTokenBlock(cssContent, ':root')
  const darkTokens = parseTokenBlock(cssContent, 'html.dark')
  const definedTokens = new Set([...rootTokens, ...darkTokens])

  const violations = scanTokenUsage(stylesDir, definedTokens)

  if (violations.length === 0) {
    console.log('✅ Token usage check passed — all var() references are defined.')
    process.exit(0)
  }

  console.log(`❌ Found ${violations.length} undefined token reference(s):\n`)
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.property}`)
  }
  console.log()
  process.exit(1)
}
