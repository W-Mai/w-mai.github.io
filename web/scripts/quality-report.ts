#!/usr/bin/env bun
/**
 * Unified quality report.
 * Executes all check scripts, collects results with timing,
 * and outputs a structured summary.
 */

import { execFileSync } from 'child_process'
import { join } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface QualityReport {
  total: number
  passed: number
  failed: number
  warnings: number
  checks: CheckResult[]
}

export interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  messages: string[]
  duration: number
}

// ── Check definitions ──────────────────────────────────────────────────────

interface QualityCheck {
  name: string
  script: string
  failOnError: boolean  // true = fail pipeline, false = warn only
}

const CHECKS: QualityCheck[] = [
  { name: 'Token completeness', script: 'validate-tokens.ts', failOnError: true },
  { name: 'Token usage', script: 'validate-token-usage.ts', failOnError: true },
  { name: 'WCAG contrast', script: 'check-contrast.ts', failOnError: true },
  { name: 'Aria labels', script: 'check-aria.ts', failOnError: true },
  { name: 'CSS quality', script: 'check-css-quality.ts', failOnError: true },
  { name: 'Content validation', script: 'validate-content.ts', failOnError: true },
  { name: 'Import conventions', script: 'check-imports.ts', failOnError: true },
  { name: 'Bundle size', script: 'measure-bundle.ts', failOnError: false },
]

// ── Core function ──────────────────────────────────────────────────────────

/**
 * Run a single check script and capture its result.
 * Returns a CheckResult with status, output messages, and duration.
 */
export function runCheck(check: QualityCheck, scriptsDir: string, cwd: string): CheckResult {
  const scriptPath = join(scriptsDir, check.script)
  const start = performance.now()

  let exitCode = 0
  let output = ''

  try {
    output = execFileSync('bun', ['run', scriptPath], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (err: any) {
    exitCode = err.status ?? 1
    const stdout = (err.stdout ?? '') as string
    const stderr = (err.stderr ?? '') as string
    output = (stdout + stderr).trim()
  }

  const duration = Math.round(performance.now() - start)
  const messages = output ? output.split('\n').filter(Boolean) : []

  let status: CheckResult['status']
  if (exitCode === 0) {
    status = 'pass'
  } else if (!check.failOnError) {
    status = 'warn'
  } else {
    status = 'fail'
  }

  return { name: check.name, status, messages, duration }
}

/**
 * Aggregate individual check results into a QualityReport.
 */
export function aggregateResults(checks: CheckResult[]): QualityReport {
  const passed = checks.filter(c => c.status === 'pass').length
  const failed = checks.filter(c => c.status === 'fail').length
  const warnings = checks.filter(c => c.status === 'warn').length

  return {
    total: checks.length,
    passed,
    failed,
    warnings,
    checks,
  }
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (import.meta.main) {
  const scriptsDir = import.meta.dir
  const cwd = join(import.meta.dir, '..')

  console.log('🔍 Running quality checks...\n')

  const results: CheckResult[] = []

  for (const check of CHECKS) {
    process.stdout.write(`  ⏳ ${check.name}...`)
    const result = runCheck(check, scriptsDir, cwd)
    results.push(result)

    const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌'
    // Clear the line and rewrite with result
    process.stdout.write(`\r  ${icon} ${check.name} (${result.duration}ms)\n`)
  }

  const report = aggregateResults(results)

  // Summary
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Quality Report Summary`)
  console.log(`${'═'.repeat(60)}\n`)
  console.log(`  Total:    ${report.total}`)
  console.log(`  Passed:   ${report.passed}`)
  console.log(`  Failed:   ${report.failed}`)
  console.log(`  Warnings: ${report.warnings}`)

  // List failed checks with messages
  const failedChecks = report.checks.filter(c => c.status === 'fail')
  if (failedChecks.length > 0) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`  Failed Checks`)
    console.log(`${'─'.repeat(60)}\n`)

    for (const check of failedChecks) {
      console.log(`  ❌ ${check.name}:`)
      for (const msg of check.messages) {
        console.log(`    ${msg}`)
      }
      console.log()
    }
  }

  // List warnings
  const warnChecks = report.checks.filter(c => c.status === 'warn')
  if (warnChecks.length > 0) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`  Warnings`)
    console.log(`${'─'.repeat(60)}\n`)

    for (const check of warnChecks) {
      console.log(`  ⚠️  ${check.name}:`)
      for (const msg of check.messages) {
        console.log(`    ${msg}`)
      }
      console.log()
    }
  }

  process.exit(report.failed > 0 ? 1 : 0)
}
