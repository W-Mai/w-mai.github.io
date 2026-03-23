#!/usr/bin/env bun
/**
 * Aria-label coverage checker for interactive elements.
 * Scans .astro and .tsx files for interactive elements and verifies
 * each has an accessible label (aria-label, aria-labelledby, text content, or title).
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AriaViolation {
  file: string
  line: number
  element: string
  reason: string
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Interactive HTML element tag names. */
const INTERACTIVE_TAGS = ['button', 'a', 'input', 'select', 'textarea']

/**
 * Regex matching opening tags of interactive elements or elements with
 * role="button" / onclick / onClick attributes.
 *
 * Captures:
 *  - Named interactive tags: <button ...>, <a ...>, <input ...>, etc.
 *  - Any tag with role="button", onclick, or onClick attributes.
 *
 * Uses [\s\S] inside the tag body to handle multi-line attributes.
 */
const INTERACTIVE_ELEMENT_RE = new RegExp(
  '<(' + INTERACTIVE_TAGS.join('|') + ')' +  // <button, <a, <input, etc.
  '(?=\\s|>|/>)' +                            // must be followed by space, > or />
  '([\\s\\S]*?)' +                            // attributes (non-greedy, multi-line)
  '/?>',                                      // closing > or />
  'gi'
)

/**
 * Regex matching any opening tag with role="button", onclick, or onClick.
 * This catches non-standard interactive elements like <div role="button">.
 */
const ROLE_BUTTON_RE = new RegExp(
  '<(\\w+)' +                                 // any tag name
  '(?=\\s)' +                                 // must have attributes
  '([\\s\\S]*?)' +                            // attributes
  '/?>',                                      // closing
  'gi'
)

/** Check if an attribute string contains role="button" or onclick/onClick. */
function hasInteractiveRole(attrs: string): boolean {
  return /role\s*=\s*["']button["']/i.test(attrs) ||
         /\bonclick\b/i.test(attrs) ||
         /\bonClick\b/.test(attrs)
}

/** Check if an element has an accessible label via attributes. */
function hasAccessibleLabel(attrs: string): boolean {
  // aria-label="..." or aria-label={"..."}
  if (/aria-label\s*=\s*["'{]/.test(attrs)) return true
  // aria-labelledby="..."
  if (/aria-labelledby\s*=\s*["'{]/.test(attrs)) return true
  // title="..." or title={"..."}
  if (/\btitle\s*=\s*["'{]/.test(attrs)) return true
  return false
}

/**
 * Check if an element has visible text content between opening and closing tags.
 * For self-closing elements (input, etc.), this always returns false.
 */
function hasTextContent(fullMatch: string, tagName: string): boolean {
  // Self-closing elements never have text content
  const selfClosing = ['input']
  if (selfClosing.includes(tagName.toLowerCase()) && /\/>$/.test(fullMatch)) {
    return false
  }

  // For elements like <button>Click me</button>, check for text between tags
  const openTagEnd = fullMatch.indexOf('>') + 1
  if (openTagEnd <= 0) return false

  const afterOpen = fullMatch.slice(openTagEnd)
  // Strip the closing tag itself
  const closingTagRe = new RegExp(`</${tagName}>\\s*$`, 'i')
  const inner = afterOpen.replace(closingTagRe, '')

  // Strip nested HTML/JSX tags and check for remaining content
  const withoutTags = inner.replace(/<[^>]*>/g, '')

  // Check for plain text (non-whitespace outside of JSX expressions)
  const plainText = withoutTags.replace(/\{[^}]*\}/g, '').trim()
  if (plainText.length > 0) return true

  // Check for JSX expressions that likely render text (e.g., {variable}, {a ?? b})
  // Exclude empty expressions and pure boolean/structural ones
  const jsxExpressions = withoutTags.match(/\{([^}]+)\}/g)
  if (jsxExpressions) {
    for (const expr of jsxExpressions) {
      const inner = expr.slice(1, -1).trim()
      // Skip structural JSX like {children}, {slots}, or empty
      if (inner.length > 0) return true
    }
  }

  return false
}

/**
 * Calculate line number for a character offset in a string.
 */
function lineAt(content: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++
  }
  return line
}

/** Recursively collect files with given extensions from a directory. */
function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = []

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.startsWith('.') || entry === 'node_modules') continue
      results.push(...collectFiles(fullPath, extensions))
    } else if (extensions.some(ext => entry.endsWith(ext))) {
      results.push(fullPath)
    }
  }

  return results
}

// ── Core function ──────────────────────────────────────────────────────────

/**
 * Scan source files for interactive elements missing accessible labels.
 * Returns a list of violations with file path, line number, element tag, and reason.
 */
export function checkAriaLabels(srcDir: string): AriaViolation[] {
  const violations: AriaViolation[] = []
  const files = collectFiles(srcDir, ['.astro', '.tsx'])

  for (const filePath of files) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      // Skip unreadable files
      continue
    }

    const relPath = relative(process.cwd(), filePath)
    checkFileContent(content, relPath, violations)
  }

  return violations
}

/**
 * Check a single file's content for aria violations.
 * Exported for testability.
 */
export function checkFileContent(
  content: string,
  filePath: string,
  violations: AriaViolation[],
): void {
  // We need to find interactive elements with their full content (including closing tags)
  // to check for text content between tags.
  // Strategy: find opening tags, then look ahead for closing tags.

  const checked = new Set<number>() // track offsets already checked

  // Pass 1: Check standard interactive tags
  INTERACTIVE_ELEMENT_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = INTERACTIVE_ELEMENT_RE.exec(content)) !== null) {
    const offset = match.index
    if (checked.has(offset)) continue
    checked.add(offset)

    const tagName = match[1].toLowerCase()
    const attrs = match[2] || ''
    const isSelfClosing = match[0].endsWith('/>')

    // Check for accessible label in attributes
    if (hasAccessibleLabel(attrs)) continue

    // Check for text content (non-self-closing elements)
    if (!isSelfClosing) {
      const fullElement = extractFullElement(content, offset, tagName)
      if (fullElement && hasTextContent(fullElement, tagName)) continue
    }

    // Check for slot (Astro) — <button><slot /></button> counts as having content
    if (!isSelfClosing) {
      const fullElement = extractFullElement(content, offset, tagName)
      if (fullElement && /<slot\s*\/?>/.test(fullElement)) continue
    }

    violations.push({
      file: filePath,
      line: lineAt(content, offset),
      element: `<${tagName}>`,
      reason: `Missing accessible label (aria-label, aria-labelledby, title, or text content)`,
    })
  }

  // Pass 2: Check elements with role="button" or onclick/onClick that aren't standard interactive tags
  ROLE_BUTTON_RE.lastIndex = 0
  while ((match = ROLE_BUTTON_RE.exec(content)) !== null) {
    const offset = match.index
    if (checked.has(offset)) continue

    const tagName = match[1].toLowerCase()
    const attrs = match[2] || ''

    // Skip if it's already a standard interactive tag (handled in pass 1)
    if (INTERACTIVE_TAGS.includes(tagName)) continue

    // Only process if it has role="button" or onclick/onClick
    if (!hasInteractiveRole(attrs)) continue

    checked.add(offset)

    if (hasAccessibleLabel(attrs)) continue

    // Check for text content
    const fullElement = extractFullElement(content, offset, tagName)
    if (fullElement && hasTextContent(fullElement, tagName)) continue

    // Check for slot
    if (fullElement && /<slot\s*\/?>/.test(fullElement)) continue

    const reason = /role\s*=\s*["']button["']/i.test(attrs)
      ? `Element with role="button" missing accessible label`
      : `Element with onclick/onClick missing accessible label`

    violations.push({
      file: filePath,
      line: lineAt(content, offset),
      element: `<${tagName}>`,
      reason,
    })
  }
}

/**
 * Extract the full element including content up to its closing tag.
 * Returns null if no closing tag is found (self-closing or malformed).
 */
function extractFullElement(content: string, startOffset: number, tagName: string): string | null {
  // Find the end of the opening tag
  const openTagEnd = content.indexOf('>', startOffset)
  if (openTagEnd < 0) return null

  // Self-closing tag
  if (content[openTagEnd - 1] === '/') {
    return content.slice(startOffset, openTagEnd + 1)
  }

  // Find matching closing tag (simple approach — works for non-nested same-tag cases)
  const closeTag = `</${tagName}>`
  const closeTagLower = closeTag.toLowerCase()

  // Search for closing tag, handling nesting
  let depth = 1
  let pos = openTagEnd + 1
  const openPattern = new RegExp(`<${tagName}(?=\\s|>|/>)`, 'gi')
  const closePattern = new RegExp(`</${tagName}>`, 'gi')

  // Simple scan: find the next closing tag at the same depth
  while (pos < content.length && depth > 0) {
    const nextOpen = content.slice(pos).search(new RegExp(`<${tagName}(?=\\s|>|/>)`, 'i'))
    const nextClose = content.slice(pos).search(new RegExp(`</${tagName}>`, 'i'))

    if (nextClose < 0) break // no closing tag found

    if (nextOpen >= 0 && nextOpen < nextClose) {
      // Found another opening tag before the closing tag
      depth++
      pos += nextOpen + 1
    } else {
      depth--
      if (depth === 0) {
        const endPos = pos + nextClose + closeTag.length
        return content.slice(startOffset, endPos)
      }
      pos += nextClose + 1
    }
  }

  // Fallback: return content up to a reasonable distance
  const maxLookahead = 500
  const end = Math.min(startOffset + maxLookahead, content.length)
  return content.slice(startOffset, end)
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (import.meta.main) {
  const srcDir = join(import.meta.dir, '..', 'src')

  const violations = checkAriaLabels(srcDir)

  if (violations.length === 0) {
    console.log('✅ Aria check passed — all interactive elements have accessible labels.')
    process.exit(0)
  }

  console.log(`❌ Aria violations found: ${violations.length}\n`)

  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.element}`)
    console.log(`    ${v.reason}\n`)
  }

  process.exit(1)
}
