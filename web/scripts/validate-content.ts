#!/usr/bin/env bun
/**
 * Content validator for MDX posts.
 * Scans posts/ directory for .mdx files and validates:
 * - Required frontmatter fields (title, description, pubDate)
 * - Internal link references (/blog/... URLs map to existing posts)
 * - Local image references point to existing files
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContentViolation {
  file: string
  issue: string
}

// ── Core functions ─────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['title', 'description', 'pubDate']

/**
 * Validate that required frontmatter fields are present.
 * Expects YAML frontmatter delimited by `---`.
 */
export function validateFrontmatter(file: string, content: string): ContentViolation[] {
  const violations: ContentViolation[] = []

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) {
    violations.push({ file, issue: 'Missing frontmatter block (no --- delimiters found)' })
    return violations
  }

  const fmBody = fmMatch[1]

  for (const field of REQUIRED_FIELDS) {
    // Match `field:` at the start of a line (handles quoted and unquoted values)
    const fieldRe = new RegExp(`^${field}\\s*:`, 'm')
    if (!fieldRe.test(fmBody)) {
      violations.push({ file, issue: `Missing required frontmatter field: ${field}` })
    }
  }

  return violations
}

/**
 * Validate internal links: /blog/... URLs should correspond to existing posts.
 */
export function validateInternalLinks(
  file: string,
  content: string,
  allPosts: string[],
): ContentViolation[] {
  const violations: ContentViolation[] = []

  // Match markdown links and bare URLs with /blog/ prefix
  // Patterns: [text](/blog/slug), [text](/blog/slug#anchor), (/blog/slug)
  const linkRe = /(?:\[.*?\]\(|(?<=\())\/blog\/([\w-]+)(?:[#?][^)\s]*)?\)?/g
  let match: RegExpExecArray | null

  while ((match = linkRe.exec(content)) !== null) {
    const slug = match[1]
    if (!allPosts.includes(slug)) {
      violations.push({
        file,
        issue: `Internal link /blog/${slug} does not match any post directory`,
      })
    }
  }

  return violations
}

/**
 * Validate local image references point to existing files.
 * Checks relative paths like `./image.png` or `./subdir/image.jpg` in markdown image syntax
 * and JSX/HTML img src attributes.
 */
export function validateLocalImages(file: string, content: string): ContentViolation[] {
  const violations: ContentViolation[] = []
  const postDir = dirname(file)

  // Strip frontmatter to avoid false positives
  const body = content.replace(/^---[\s\S]*?---/, '')

  // Match markdown images: ![alt](./path) or ![alt](path)
  const mdImageRe = /!\[.*?\]\((\.[^)]+)\)/g
  let match: RegExpExecArray | null

  while ((match = mdImageRe.exec(body)) !== null) {
    const imgPath = match[1]
    const resolved = join(postDir, imgPath)
    if (!existsSync(resolved)) {
      violations.push({ file, issue: `Local image not found: ${imgPath}` })
    }
  }

  // Match HTML/JSX img src: src="./path" or src={'./path'}
  const htmlImageRe = /src\s*=\s*["'{]\s*(\.\/.+?)["'}]/g
  while ((match = htmlImageRe.exec(body)) !== null) {
    const imgPath = match[1]
    const resolved = join(postDir, imgPath)
    if (!existsSync(resolved)) {
      violations.push({ file, issue: `Local image not found: ${imgPath}` })
    }
  }

  return violations
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Recursively collect all index.mdx files under a directory. */
function collectMdxFiles(dir: string): string[] {
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
      if (entry.startsWith('.') || entry === 'node_modules') continue
      results.push(...collectMdxFiles(fullPath))
    } else if (entry.endsWith('.mdx')) {
      results.push(fullPath)
    }
  }

  return results
}

/** Extract post slugs from the posts directory structure. */
function getPostSlugs(postsDir: string): string[] {
  try {
    return readdirSync(postsDir).filter(entry => {
      const fullPath = join(postsDir, entry)
      try {
        return statSync(fullPath).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (import.meta.main) {
  const postsDir = join(import.meta.dir, '..', '..', 'posts')

  if (!existsSync(postsDir)) {
    console.error(`Error: posts directory not found at ${postsDir}`)
    process.exit(1)
  }

  const mdxFiles = collectMdxFiles(postsDir)
  if (mdxFiles.length === 0) {
    console.error('Error: no .mdx files found in posts/')
    process.exit(1)
  }

  const allSlugs = getPostSlugs(postsDir)
  const violations: ContentViolation[] = []

  for (const filePath of mdxFiles) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      violations.push({ file: relative(process.cwd(), filePath), issue: 'Cannot read file' })
      continue
    }

    const relPath = relative(process.cwd(), filePath)

    violations.push(
      ...validateFrontmatter(relPath, content),
      ...validateInternalLinks(relPath, content, allSlugs),
      ...validateLocalImages(relPath, content),
    )
  }

  if (violations.length === 0) {
    console.log(`✅ Content validation passed — ${mdxFiles.length} posts checked.`)
    process.exit(0)
  }

  console.log(`❌ Content violations found: ${violations.length}\n`)

  // Group by file for readability
  const byFile = new Map<string, string[]>()
  for (const v of violations) {
    const issues = byFile.get(v.file) ?? []
    issues.push(v.issue)
    byFile.set(v.file, issues)
  }

  for (const [file, issues] of byFile) {
    console.log(`  ${file}:`)
    for (const issue of issues) {
      console.log(`    - ${issue}`)
    }
    console.log()
  }

  process.exit(1)
}
