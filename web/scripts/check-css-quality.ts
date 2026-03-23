#!/usr/bin/env bun
/**
 * Unified CSS quality scanner.
 * Delegates to existing scan scripts and adds responsive consistency
 * and inline hover pattern detection.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, relative } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CSSQualityResult {
  classGroups: { exitCode: number; output: string }
  semanticCandidates: { exitCode: number; output: string }
  longClasses: { exitCode: number; output: string }
  responsiveConsistency: { exitCode: number; output: string }
}

export interface ResponsiveViolation {
  file: string
  line: number
  property: string
  reason: string
}

export interface HoverPatternViolation {
  file: string
  line: number
  reason: string
}

// ── File collection ────────────────────────────────────────────────────────

const EXTENSIONS = ['.astro', '.tsx', '.jsx', '.css']

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

// ── Responsive consistency check ───────────────────────────────────────────

/**
 * CSS properties commonly used with responsive values.
 * We normalize property names to catch both CSS properties and Tailwind prefixes.
 */
const RESPONSIVE_PREFIXES = /\b(sm|md|lg|xl|2xl):/
const MEDIA_QUERY_RE = /@media\s*\(/

/**
 * Extract CSS property names from clamp() usages in a line.
 * Matches patterns like `font-size: clamp(...)` or Tailwind `text-[clamp(...)]`.
 */
function extractClampProperties(line: string): string[] {
  const props: string[] = []

  // CSS property: value with clamp()
  const cssPropMatch = line.match(/([\w-]+)\s*:\s*[^;]*clamp\s*\(/)
  if (cssPropMatch) {
    props.push(cssPropMatch[1])
  }

  // Tailwind arbitrary value with clamp: text-[clamp(...)], w-[clamp(...)], etc.
  const twClampRe = /\b(text|w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|max-w|min-w|max-h|min-h|leading|tracking)-\[clamp\(/g
  let match: RegExpExecArray | null
  while ((match = twClampRe.exec(line)) !== null) {
    props.push(mapTailwindToProperty(match[1]))
  }

  return props
}

/**
 * Extract CSS property names from responsive prefix usages (sm:, md:, etc.).
 */
function extractResponsivePrefixProperties(line: string): string[] {
  const props: string[] = []
  const re = /\b(?:sm|md|lg|xl|2xl):(text|w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|max-w|min-w|max-h|min-h|leading|tracking)-/g
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    props.push(mapTailwindToProperty(match[1]))
  }
  return props
}

/** Map Tailwind utility prefix to a normalized CSS property name. */
function mapTailwindToProperty(tw: string): string {
  const map: Record<string, string> = {
    'text': 'font-size',
    'w': 'width',
    'h': 'height',
    'p': 'padding',
    'px': 'padding-inline',
    'py': 'padding-block',
    'pt': 'padding-top',
    'pb': 'padding-bottom',
    'pl': 'padding-left',
    'pr': 'padding-right',
    'm': 'margin',
    'mx': 'margin-inline',
    'my': 'margin-block',
    'mt': 'margin-top',
    'mb': 'margin-bottom',
    'ml': 'margin-left',
    'mr': 'margin-right',
    'gap': 'gap',
    'space-x': 'column-gap',
    'space-y': 'row-gap',
    'max-w': 'max-width',
    'min-w': 'min-width',
    'max-h': 'max-height',
    'min-h': 'min-height',
    'leading': 'line-height',
    'tracking': 'letter-spacing',
  }
  return map[tw] ?? tw
}

/**
 * Detect mixed clamp() + fixed breakpoint usage on the same property
 * within a single component file.
 */
export function checkResponsiveConsistency(srcDir: string): ResponsiveViolation[] {
  const violations: ResponsiveViolation[] = []
  const files = collectFiles(srcDir, EXTENSIONS)

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n')

    // Track which properties use clamp() and which use responsive prefixes/@media
    const clampProps = new Map<string, number>()   // property → first line
    const breakpointProps = new Map<string, number>()
    let hasMediaQuery = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for clamp() usage
      for (const prop of extractClampProperties(line)) {
        if (!clampProps.has(prop)) clampProps.set(prop, i + 1)
      }

      // Check for responsive prefix usage (sm:, md:, etc.)
      for (const prop of extractResponsivePrefixProperties(line)) {
        if (!breakpointProps.has(prop)) breakpointProps.set(prop, i + 1)
      }

      // Check for @media queries
      if (MEDIA_QUERY_RE.test(line)) {
        hasMediaQuery = true
      }
    }

    // Report properties that appear in both clamp and breakpoint sets
    for (const [prop, clampLine] of clampProps) {
      if (breakpointProps.has(prop)) {
        violations.push({
          file: relative(join(srcDir, '..'), file),
          line: clampLine,
          property: prop,
          reason: `Mixed clamp() (line ${clampLine}) and responsive prefix (line ${breakpointProps.get(prop)}) for "${prop}"`,
        })
      }
    }

    // Also check clamp properties against @media usage for CSS properties
    if (hasMediaQuery && clampProps.size > 0) {
      // Scan @media blocks for properties that also use clamp()
      const mediaBlockProps = extractMediaBlockProperties(content)
      for (const [prop, clampLine] of clampProps) {
        if (mediaBlockProps.has(prop) && !breakpointProps.has(prop)) {
          violations.push({
            file: relative(join(srcDir, '..'), file),
            line: clampLine,
            property: prop,
            reason: `Mixed clamp() (line ${clampLine}) and @media fixed breakpoint for "${prop}"`,
          })
        }
      }
    }
  }

  return violations
}

/** Extract CSS property names defined inside @media blocks. */
function extractMediaBlockProperties(content: string): Set<string> {
  const props = new Set<string>()
  const mediaRe = /@media\s*\([^)]*\)\s*\{/g
  let match: RegExpExecArray | null

  while ((match = mediaRe.exec(content)) !== null) {
    const braceStart = content.indexOf('{', match.index)
    const body = extractBraceBlock(content, braceStart)
    if (!body) continue

    // Extract property names from declarations inside the media block
    const propRe = /([\w-]+)\s*:\s*[^;]+;/g
    let propMatch: RegExpExecArray | null
    while ((propMatch = propRe.exec(body)) !== null) {
      const propName = propMatch[1]
      if (propName && !propName.startsWith('--')) {
        props.add(propName)
      }
    }
  }

  return props
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

// ── Inline hover pattern detection ─────────────────────────────────────────

/**
 * Detect inline card hover patterns: translateY + shadow changes on :hover
 * without using the `neu-card-hover` class.
 *
 * Checks both CSS :hover blocks and Tailwind hover: prefixes.
 */
export function checkInlineHoverPatterns(srcDir: string): HoverPatternViolation[] {
  const violations: HoverPatternViolation[] = []
  const files = collectFiles(srcDir, EXTENSIONS)

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')

    // Skip the neumorphism.css file itself (that's where neu-card-hover is defined)
    if (file.endsWith('neumorphism.css')) continue

    const lines = content.split('\n')

    // Strategy 1: Detect Tailwind hover:translateY + hover:shadow in class strings
    checkTailwindHoverPatterns(file, srcDir, lines, violations)

    // Strategy 2: Detect CSS :hover blocks with translateY + shadow
    checkCSSHoverBlocks(file, srcDir, content, lines, violations)
  }

  return violations
}

const CLASS_RE = /class(?:Name)?[=:](?:\{[`"]([^`"]*)[`"]\}|"([^"]*)"|'([^']*)'|`([^`]*)`)/g

/** Check Tailwind class strings for hover:translateY + hover:shadow patterns. */
function checkTailwindHoverPatterns(
  file: string,
  srcDir: string,
  lines: string[],
  violations: HoverPatternViolation[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    CLASS_RE.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = CLASS_RE.exec(line)) !== null) {
      const classStr = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim()
      if (!classStr) continue

      // Skip if already using neu-card-hover
      if (classStr.includes('neu-card-hover')) continue

      const hasHoverTranslateY = /hover:[^\s]*translate[yY]/.test(classStr)
        || /hover:-translate-y/.test(classStr)
      const hasHoverShadow = /hover:[^\s]*shadow/.test(classStr)

      if (hasHoverTranslateY && hasHoverShadow) {
        violations.push({
          file: relative(join(srcDir, '..'), file),
          line: i + 1,
          reason: 'Inline hover pattern (translateY + shadow) — consider using .neu-card-hover',
        })
      }
    }
  }
}

/** Check CSS :hover blocks for translateY + shadow patterns. */
function checkCSSHoverBlocks(
  file: string,
  srcDir: string,
  content: string,
  lines: string[],
  violations: HoverPatternViolation[],
): void {
  // Find :hover blocks — extract only the last selector segment before :hover
  const hoverRe = /([\w.#[\]="-]+):hover\s*\{/g
  let match: RegExpExecArray | null

  while ((match = hoverRe.exec(content)) !== null) {
    const selector = match[1].trim()

    // Skip if the selector is .neu-card-hover itself
    if (selector.includes('neu-card-hover')) continue

    const braceStart = content.indexOf('{', match.index + match[0].length - 1)
    const body = extractBraceBlock(content, braceStart)
    if (!body) continue

    const hasTranslateY = /translateY/i.test(body)
    const hasShadow = /box-shadow/i.test(body)

    if (hasTranslateY && hasShadow) {
      // Find line number
      const lineNum = content.slice(0, match.index).split('\n').length
      violations.push({
        file: relative(join(srcDir, '..'), file),
        line: lineNum,
        reason: `CSS :hover block with translateY + shadow on "${selector}" — consider using .neu-card-hover`,
      })
    }
  }
}

// ── Subprocess delegation ──────────────────────────────────────────────────

/** Run an existing scan script as a subprocess and capture output + exit code. */
async function runScript(scriptName: string): Promise<{ exitCode: number; output: string }> {
  const scriptPath = join(import.meta.dir, scriptName)
  const cwd = join(import.meta.dir, '..')

  try {
    const output = execFileSync('bun', ['run', scriptPath], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { exitCode: 0, output: output.trim() }
  } catch (err: any) {
    const stdout = (err.stdout ?? '') as string
    const stderr = (err.stderr ?? '') as string
    return {
      exitCode: err.status ?? 1,
      output: (stdout + stderr).trim(),
    }
  }
}

// ── Main check function ────────────────────────────────────────────────────

/** Run all CSS quality checks and aggregate results. */
export async function checkCSSQuality(): Promise<CSSQualityResult> {
  const srcDir = join(import.meta.dir, '..', 'src')

  // Run existing scripts in parallel
  const [classGroups, semanticCandidates, longClasses] = await Promise.all([
    runScript('scan-class-groups.ts'),
    runScript('scan-semantic-candidates.ts'),
    runScript('scan-long-classes.ts'),
  ])

  // Run responsive consistency check
  const responsiveViolations = checkResponsiveConsistency(srcDir)
  const hoverViolations = checkInlineHoverPatterns(srcDir)

  // Build responsive consistency output
  let responsiveOutput = ''
  let responsiveExitCode = 0

  if (responsiveViolations.length > 0) {
    responsiveOutput += `⚠️  Responsive consistency issues (${responsiveViolations.length}):\n`
    for (const v of responsiveViolations) {
      responsiveOutput += `  ${v.file}:${v.line} [${v.property}]\n    ${v.reason}\n\n`
    }
  }

  if (hoverViolations.length > 0) {
    responsiveOutput += `⚠️  Inline hover patterns (${hoverViolations.length}):\n`
    for (const v of hoverViolations) {
      responsiveOutput += `  ${v.file}:${v.line}\n    ${v.reason}\n\n`
    }
  }

  if (responsiveViolations.length === 0 && hoverViolations.length === 0) {
    responsiveOutput = '✅ No responsive consistency or inline hover pattern issues found.'
  } else {
    responsiveExitCode = 1
  }

  return {
    classGroups,
    semanticCandidates,
    longClasses,
    responsiveConsistency: {
      exitCode: responsiveExitCode,
      output: responsiveOutput.trim(),
    },
  }
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (import.meta.main) {
  const result = await checkCSSQuality()

  const sections = [
    { name: 'Class Groups', data: result.classGroups },
    { name: 'Semantic Candidates', data: result.semanticCandidates },
    { name: 'Long Classes', data: result.longClasses },
    { name: 'Responsive Consistency & Hover Patterns', data: result.responsiveConsistency },
  ]

  let hasFailure = false

  for (const section of sections) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${section.name}`)
    console.log(`${'═'.repeat(60)}\n`)
    console.log(section.data.output)

    if (section.data.exitCode !== 0) hasFailure = true
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Summary`)
  console.log(`${'═'.repeat(60)}\n`)

  for (const section of sections) {
    const icon = section.data.exitCode === 0 ? '✅' : '⚠️'
    console.log(`  ${icon} ${section.name}`)
  }

  console.log()
  process.exit(hasFailure ? 1 : 0)
}
