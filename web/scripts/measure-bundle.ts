#!/usr/bin/env bun
/**
 * Bundle size monitor.
 * Scans web/dist/ for JS/CSS files, measures sizes,
 * compares against previous measurements, and stores history.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs'
import { join, relative } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BundleMeasurement {
  totalSize: number
  files: { path: string; size: number }[]
  timestamp: string
}

export interface BundleComparison {
  totalDelta: number
  totalDeltaPercent: number
  warnings: { file: string; oldSize: number; newSize: number; deltaPercent: number }[]
}

interface BundleSizeHistory {
  measurements: BundleMeasurement[]
}

// ── Core functions ─────────────────────────────────────────────────────────

/**
 * Scan a directory for JS/CSS files and measure their sizes.
 * Returns a BundleMeasurement with all files sorted by path.
 */
export function measureBundles(distDir: string): BundleMeasurement {
  const files: { path: string; size: number }[] = []
  collectBundleFiles(distDir, distDir, files)

  files.sort((a, b) => a.path.localeCompare(b.path))

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return {
    totalSize,
    files,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Compare two bundle measurements.
 * Emits warnings for files whose size increased by more than 10%.
 */
export function compareBundles(
  current: BundleMeasurement,
  previous: BundleMeasurement,
): BundleComparison {
  const totalDelta = current.totalSize - previous.totalSize
  const totalDeltaPercent = previous.totalSize === 0
    ? (current.totalSize === 0 ? 0 : 100)
    : (totalDelta / previous.totalSize) * 100

  const warnings: BundleComparison['warnings'] = []

  // Build a map of previous file sizes for lookup
  const prevMap = new Map<string, number>()
  for (const f of previous.files) {
    prevMap.set(f.path, f.size)
  }

  for (const file of current.files) {
    const oldSize = prevMap.get(file.path)
    if (oldSize === undefined) continue // new file, no comparison

    if (oldSize === 0) {
      // Avoid division by zero — only warn if new size is non-zero
      if (file.size > 0) {
        warnings.push({ file: file.path, oldSize, newSize: file.size, deltaPercent: 100 })
      }
      continue
    }

    const deltaPercent = ((file.size - oldSize) / oldSize) * 100
    if (deltaPercent > 10) {
      warnings.push({
        file: file.path,
        oldSize,
        newSize: file.size,
        deltaPercent: Math.round(deltaPercent * 100) / 100,
      })
    }
  }

  return {
    totalDelta,
    totalDeltaPercent: Math.round(totalDeltaPercent * 100) / 100,
    warnings,
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Recursively collect .js and .css files from a directory. */
function collectBundleFiles(
  baseDir: string,
  dir: string,
  into: { path: string; size: number }[],
): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
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
      collectBundleFiles(baseDir, fullPath, into)
    } else if (entry.endsWith('.js') || entry.endsWith('.css')) {
      into.push({
        path: relative(baseDir, fullPath),
        size: stat.size,
      })
    }
  }
}

/** Format bytes into a human-readable string. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

/** Load bundle size history from disk. */
function loadHistory(historyPath: string): BundleSizeHistory {
  try {
    const raw = readFileSync(historyPath, 'utf-8')
    return JSON.parse(raw) as BundleSizeHistory
  } catch {
    return { measurements: [] }
  }
}

/** Save bundle size history to disk, keeping only the last 10 measurements. */
function saveHistory(historyPath: string, history: BundleSizeHistory): void {
  // Ensure parent directory exists
  const dir = join(historyPath, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Keep only the last 10 measurements
  history.measurements = history.measurements.slice(0, 10)
  writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n')
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (import.meta.main) {
  const distDir = join(import.meta.dir, '..', 'dist')
  const historyPath = join(import.meta.dir, '..', '.astro', 'bundle-sizes.json')

  // Exit gracefully if dist/ doesn't exist (not built yet)
  if (!existsSync(distDir)) {
    console.log('ℹ web/dist/ not found — skipping bundle measurement (run astro build first).')
    process.exit(0)
  }

  const current = measureBundles(distDir)

  const jsFiles = current.files.filter(f => f.path.endsWith('.js'))
  const cssFiles = current.files.filter(f => f.path.endsWith('.css'))
  const jsTotal = jsFiles.reduce((s, f) => s + f.size, 0)
  const cssTotal = cssFiles.reduce((s, f) => s + f.size, 0)

  console.log(`📦 Bundle size report:`)
  console.log(`  Total:  ${formatSize(current.totalSize)} (${current.files.length} files)`)
  console.log(`  JS:     ${formatSize(jsTotal)} (${jsFiles.length} files)`)
  console.log(`  CSS:    ${formatSize(cssTotal)} (${cssFiles.length} files)`)

  // Compare with previous measurement
  const history = loadHistory(historyPath)
  const previous = history.measurements[0]

  if (previous) {
    const comparison = compareBundles(current, previous)
    const sign = comparison.totalDelta >= 0 ? '+' : ''
    console.log(`\n  Delta:  ${sign}${formatSize(comparison.totalDelta)} (${sign}${comparison.totalDeltaPercent}%)`)

    if (comparison.warnings.length > 0) {
      console.log(`\n  ⚠ Size increase warnings (>10%):`)
      for (const w of comparison.warnings) {
        console.log(`    ${w.file}: ${formatSize(w.oldSize)} → ${formatSize(w.newSize)} (+${w.deltaPercent}%)`)
      }
    }
  } else {
    console.log('\n  No previous measurement — baseline recorded.')
  }

  // Store current measurement (most recent first)
  history.measurements.unshift(current)
  saveHistory(historyPath, history)

  console.log(`\n✅ Bundle measurement saved.`)
  process.exit(0)
}
