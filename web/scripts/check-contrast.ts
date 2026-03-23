#!/usr/bin/env bun
/**
 * WCAG 2.1 contrast ratio checker for design tokens.
 * Parses tokens.css, pairs text tokens with background tokens,
 * and reports violations below AA thresholds.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { parseTokenBlock } from './validate-tokens'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContrastViolation {
  theme: 'light' | 'dark'
  textToken: string
  bgToken: string
  ratio: number
  required: number  // 4.5 for normal, 3.0 for large text
  level: 'normal' | 'large'
}

// ── Color parsing ──────────────────────────────────────────────────────────

/**
 * Parse a hex color string (#RGB or #RRGGBB) into [r, g, b] (0-255).
 * Throws on invalid input.
 */
export function parseHexColor(hex: string): [number, number, number] {
  const h = hex.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  if (h.length === 4) {
    // #RGB → #RRGGBB
    const r = parseInt(h[1] + h[1], 16)
    const g = parseInt(h[2] + h[2], 16)
    const b = parseInt(h[3] + h[3], 16)
    return [r, g, b]
  }
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return [r, g, b]
}

/**
 * Parse `rgb(r g b / a)` or `rgba(r, g, b, a)` format into [r, g, b].
 * Returns null for unparseable values (gradients, var() references, etc.).
 */
export function parseRgbColor(rgb: string): [number, number, number] | null {
  const v = rgb.trim()

  // rgb(r g b) or rgb(r g b / a) — modern syntax
  const modernRgb = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/)
  if (modernRgb) {
    return [parseInt(modernRgb[1]), parseInt(modernRgb[2]), parseInt(modernRgb[3])]
  }

  // rgba(r, g, b, a) or rgb(r, g, b) — legacy syntax
  const legacyRgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+%?)?\s*\)$/)
  if (legacyRgb) {
    return [parseInt(legacyRgb[1]), parseInt(legacyRgb[2]), parseInt(legacyRgb[3])]
  }

  return null
}

/**
 * Try to parse a CSS color value into [r, g, b].
 * Supports: #RGB, #RRGGBB, rgb(r g b), rgb(r g b / a), rgba(r, g, b, a).
 * Returns null for unparseable values (gradients, var() references, etc.).
 */
function tryParseColor(value: string): [number, number, number] | null {
  const v = value.trim()

  // Hex colors
  if (v.startsWith('#')) {
    try {
      return parseHexColor(v)
    } catch {
      return null
    }
  }

  return parseRgbColor(v)
}

// ── WCAG 2.1 luminance & contrast ──────────────────────────────────────────

/**
 * Calculate relative luminance per WCAG 2.1 definition.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio from two luminance values.
 * Result is always >= 1 (lighter / darker).
 */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Token value extraction ─────────────────────────────────────────────────

const TOKEN_VALUE_RE = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*;?\s*$/

/** Strip trailing CSS comments and semicolons from a token value. */
function cleanTokenValue(raw: string): string {
  return raw.replace(/\/\*.*?\*\//g, '').replace(/;+\s*$/, '').trim()
}

/**
 * Extract custom property name→value pairs from a CSS block matching the given selector.
 * Returns a map of property name to value string.
 */
export function parseTokenValues(css: string, selector: string): Map<string, string> {
  const values = new Map<string, string>()

  // Use parseTokenBlock to identify which tokens exist (validates the selector matching)
  const tokenNames = parseTokenBlock(css, selector)

  // Now extract values by scanning the CSS for the matching block
  if (selector === ':root') {
    extractValuesFromBlocks(css, /:root\s*\{/g, values, 0)
  } else if (selector === 'html.dark') {
    extractValuesFromBlocks(css, /html\.dark\s*\{/g, values)
  }

  // Only keep tokens that parseTokenBlock also found (consistency)
  for (const key of [...values.keys()]) {
    if (!tokenNames.has(key)) values.delete(key)
  }

  return values
}

/**
 * Find blocks matching a regex pattern and extract token name→value pairs.
 * When requiredDepth is specified, only matches blocks at that brace depth.
 */
function extractValuesFromBlocks(
  css: string,
  pattern: RegExp,
  into: Map<string, string>,
  requiredDepth?: number,
): void {
  let match: RegExpExecArray | null
  while ((match = pattern.exec(css)) !== null) {
    if (requiredDepth !== undefined) {
      let depth = 0
      for (let i = 0; i < match.index; i++) {
        if (css[i] === '{') depth++
        else if (css[i] === '}') depth--
      }
      if (depth !== requiredDepth) continue
    }

    const braceStart = css.indexOf('{', match.index)
    const body = extractBraceBlock(css, braceStart)
    if (!body) continue

    for (const line of body.split('\n')) {
      const m = line.match(TOKEN_VALUE_RE)
      if (m) into.set(m[1], cleanTokenValue(m[2]))
    }
  }
}

/** Find the brace-balanced block body starting at the `{` at position `start`. */
function extractBraceBlock(css: string, start: number): string | null {
  if (css[start] !== '{') return null
  let depth = 0
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(start + 1, i)
    }
  }
  return null
}

// ── Main check function ────────────────────────────────────────────────────

/**
 * Check contrast ratios between text and background tokens.
 * Returns violations where ratio is below WCAG AA thresholds.
 */
export function checkContrast(cssContent: string): ContrastViolation[] {
  const violations: ContrastViolation[] = []

  const themes: Array<{ name: 'light' | 'dark'; selector: string }> = [
    { name: 'light', selector: ':root' },
    { name: 'dark', selector: 'html.dark' },
  ]

  for (const { name: theme, selector } of themes) {
    const tokens = parseTokenValues(cssContent, selector)

    // Identify text tokens (--text-*)
    const textTokens = new Map<string, [number, number, number]>()
    for (const [key, val] of tokens) {
      if (key.startsWith('--text-')) {
        const rgb = tryParseColor(val)
        if (rgb) textTokens.set(key, rgb)
      }
    }

    // Identify background tokens (--neu-bg, --bg-*)
    const bgTokens = new Map<string, [number, number, number]>()
    for (const [key, val] of tokens) {
      if (key === '--neu-bg' || key.startsWith('--bg-')) {
        const rgb = tryParseColor(val)
        if (rgb) bgTokens.set(key, rgb)
      }
    }

    // Pair every text token with every background token
    for (const [textName, textRgb] of textTokens) {
      const textLum = relativeLuminance(...textRgb)

      for (const [bgName, bgRgb] of bgTokens) {
        const bgLum = relativeLuminance(...bgRgb)
        const ratio = contrastRatio(textLum, bgLum)

        // Treat all text as normal text for now (4.5:1 threshold)
        const required = 4.5
        const level: 'normal' | 'large' = 'normal'

        if (ratio < required) {
          violations.push({
            theme,
            textToken: textName,
            bgToken: bgName,
            ratio: Math.round(ratio * 100) / 100,
            required,
            level,
          })
        }
      }
    }
  }

  return violations
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (import.meta.main) {
  const tokensPath = join(import.meta.dir, '..', 'src', 'styles', 'tokens.css')

  let cssContent: string
  try {
    cssContent = readFileSync(tokensPath, 'utf-8')
  } catch {
    console.error(`Error: cannot read ${tokensPath}`)
    process.exit(1)
  }

  const violations = checkContrast(cssContent)

  if (violations.length === 0) {
    console.log('✅ Contrast check passed — all text/background pairs meet WCAG AA.')
    process.exit(0)
  }

  // Separate known issues from unexpected violations
  const knownIssue = (v: ContrastViolation) =>
    v.theme === 'dark' && v.textToken === '--text-muted' && v.bgToken === '--neu-bg'

  const known = violations.filter(knownIssue)
  const unexpected = violations.filter(v => !knownIssue(v))

  console.log(`❌ Contrast violations found: ${violations.length}\n`)

  if (unexpected.length > 0) {
    console.log(`  Violations (${unexpected.length}):`)
    for (const v of unexpected) {
      console.log(
        `    [${v.theme}] ${v.textToken} on ${v.bgToken}: ` +
        `${v.ratio}:1 (required ${v.required}:1 for ${v.level} text)`
      )
    }
    console.log()
  }

  if (known.length > 0) {
    console.log(`  ⚠ Known issues (${known.length}):`)
    for (const v of known) {
      console.log(
        `    [${v.theme}] ${v.textToken} on ${v.bgToken}: ` +
        `${v.ratio}:1 (required ${v.required}:1 for ${v.level} text) — known dark mode issue`
      )
    }
    console.log()
  }

  process.exit(1)
}
