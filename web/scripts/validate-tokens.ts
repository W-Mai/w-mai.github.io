#!/usr/bin/env bun
/**
 * Token completeness validator.
 * Parses tokens.css and verifies every custom property in :root
 * has a corresponding definition in html.dark, and vice versa.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TokenValidationResult {
  rootOnly: string[]   // tokens in :root but missing from html.dark
  darkOnly: string[]   // tokens in html.dark but missing from :root
  valid: boolean
}

// ── Core functions ─────────────────────────────────────────────────────────

/**
 * Extract custom property names from a CSS block matching the given selector.
 *
 * For `:root`, matches the top-level `:root { ... }` block (not nested
 * inside @media). Also collects tokens from `@media (prefers-color-scheme: dark) { :root { ... } }`
 * since those are still :root-scoped overrides.
 *
 * For `html.dark`, matches the `html.dark { ... }` block.
 */
export function parseTokenBlock(css: string, selector: string): Set<string> {
  const tokens = new Set<string>()

  if (selector === ':root') {
    // Collect from top-level :root blocks and @media (...) { :root { ... } } blocks
    collectFromTopLevelRoot(css, tokens)
    collectFromMediaRoot(css, tokens)
  } else if (selector === 'html.dark') {
    collectFromSelector(css, 'html.dark', tokens)
  }

  return tokens
}

/**
 * Validate that :root and html.dark define the same set of tokens.
 */
export function validateTokenCompleteness(cssContent: string): TokenValidationResult {
  const rootTokens = parseTokenBlock(cssContent, ':root')
  const darkTokens = parseTokenBlock(cssContent, 'html.dark')

  const rootOnly = [...rootTokens].filter(t => !darkTokens.has(t)).sort()
  const darkOnly = [...darkTokens].filter(t => !rootTokens.has(t)).sort()

  return {
    rootOnly,
    darkOnly,
    valid: rootOnly.length === 0 && darkOnly.length === 0,
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

const CUSTOM_PROP_RE = /^\s*(--[\w-]+)\s*:/

/** Extract all `--prop: value;` lines from a brace-delimited block body. */
function extractProps(blockBody: string, into: Set<string>): void {
  for (const line of blockBody.split('\n')) {
    const m = line.match(CUSTOM_PROP_RE)
    if (m) into.add(m[1])
  }
}

/**
 * Find the brace-balanced block body starting at the `{` at position `start`.
 * Returns the content between the outermost `{ }`, or null if unbalanced.
 */
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

/**
 * Collect tokens from top-level `:root { ... }` blocks
 * (those NOT nested inside @media or other at-rules).
 */
function collectFromTopLevelRoot(css: string, tokens: Set<string>): void {
  // Match :root that is NOT preceded by { on the same nesting level
  // Strategy: find all `:root` occurrences, check they are at top level (depth 0)
  const re = /:root\s*\{/g
  let match: RegExpExecArray | null

  while ((match = re.exec(css)) !== null) {
    const pos = match.index
    // Check brace depth at this position — if depth > 0, it's nested
    if (braceDepthAt(css, pos) === 0) {
      const braceStart = css.indexOf('{', pos)
      const body = extractBraceBlock(css, braceStart)
      if (body) extractProps(body, tokens)
    }
  }
}

/**
 * Collect tokens from `@media (prefers-color-scheme: dark) { :root { ... } }`.
 * These override :root values for system dark preference but are still :root-scoped.
 */
function collectFromMediaRoot(css: string, tokens: Set<string>): void {
  const mediaRe = /@media\s*\([^)]*prefers-color-scheme\s*:\s*dark[^)]*\)\s*\{/g
  let match: RegExpExecArray | null

  while ((match = mediaRe.exec(css)) !== null) {
    const braceStart = css.indexOf('{', match.index)
    const mediaBody = extractBraceBlock(css, braceStart)
    if (!mediaBody) continue

    // Find :root blocks inside the media body
    const rootRe = /:root\s*\{/g
    let rootMatch: RegExpExecArray | null
    while ((rootMatch = rootRe.exec(mediaBody)) !== null) {
      const innerBrace = mediaBody.indexOf('{', rootMatch.index)
      const body = extractBraceBlock(mediaBody, innerBrace)
      if (body) extractProps(body, tokens)
    }
  }
}

/** Collect tokens from a simple selector like `html.dark`. */
function collectFromSelector(css: string, selector: string, tokens: Set<string>): void {
  const escaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(escaped + '\\s*\\{', 'g')
  let match: RegExpExecArray | null

  while ((match = re.exec(css)) !== null) {
    const braceStart = css.indexOf('{', match.index)
    const body = extractBraceBlock(css, braceStart)
    if (body) extractProps(body, tokens)
  }
}

/** Calculate brace nesting depth at a given position in the CSS string. */
function braceDepthAt(css: string, pos: number): number {
  let depth = 0
  for (let i = 0; i < pos; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') depth--
  }
  return depth
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

  if (!cssContent.trim()) {
    console.error('Error: tokens.css is empty')
    process.exit(1)
  }

  const result = validateTokenCompleteness(cssContent)

  if (result.valid) {
    console.log('✅ Token completeness check passed — :root and html.dark are in sync.')
    process.exit(0)
  }

  console.log('❌ Token completeness mismatch detected:\n')

  if (result.rootOnly.length > 0) {
    console.log(`  In :root but missing from html.dark (${result.rootOnly.length}):`)
    for (const t of result.rootOnly) console.log(`    - ${t}`)
    console.log()
  }

  if (result.darkOnly.length > 0) {
    console.log(`  In html.dark but missing from :root (${result.darkOnly.length}):`)
    for (const t of result.darkOnly) console.log(`    - ${t}`)
    console.log()
  }

  process.exit(1)
}
