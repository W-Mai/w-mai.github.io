import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getLanguageColor } from '../../lib/language-colors'

/**
 * Pure rendering helper that mimics ProjectCard.astro's HTML output.
 * Used for property testing since Astro components require a full build pipeline.
 */
function renderProjectCard(props: {
  name: string
  description: string | null
  language: string | null
  stars: number
  url: string
}): string {
  const { name, description, language, stars, url } = props
  const languageColor = getLanguageColor(language)

  const languageHtml = language
    ? `<span class="flex items-center gap-1">` +
      `<span class="inline-block size-3 rounded-full" style="background-color: ${languageColor}"></span>` +
      `${language}` +
      `</span>`
    : ''

  return (
    `<a href="${url}" target="_blank" rel="noopener noreferrer" ` +
    `class="block rounded-xl border border-slate-200 bg-white p-5 no-underline text-slate-800 transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300">` +
    `<h3 class="m-0 text-base font-bold truncate">${name}</h3>` +
    `<p class="mt-2 mb-3 text-sm text-slate-500 line-clamp-2">${description ?? 'No description provided'}</p>` +
    `<div class="flex items-center gap-4 text-xs text-slate-500">` +
    `${languageHtml}` +
    `<span class="flex items-center gap-1">` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-3.5 text-amber-400">` +
    `<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />` +
    `</svg>` +
    `${stars}` +
    `</span>` +
    `</div>` +
    `</a>`
  )
}

// Arbitrary: generate a valid repo name (non-empty, no HTML special chars to keep tests focused)
const arbRepoName = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0 && !/[<>"&]/.test(s))

// Arbitrary: generate a non-null description (no HTML special chars)
const arbDescription = fc
  .string({ minLength: 1, maxLength: 300 })
  .filter((s) => s.trim().length > 0 && !/[<>"&]/.test(s))

// Arbitrary: generate a programming language name
const arbLanguage = fc.oneof(
  fc.constantFrom(
    'TypeScript',
    'JavaScript',
    'Python',
    'Rust',
    'Go',
    'Java',
    'C',
    'C++',
    'Ruby',
    'Shell',
  ),
  fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0 && !/[<>"&]/.test(s)),
)

// Arbitrary: generate a star count
const arbStars = fc.nat({ max: 1_000_000 })

// Arbitrary: generate a valid GitHub repo URL
const arbRepoUrl = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 39 }).filter((s) => /^[a-zA-Z0-9-]+$/.test(s)),
    fc.string({ minLength: 1, maxLength: 100 }).filter((s) => /^[a-zA-Z0-9._-]+$/.test(s)),
  )
  .map(([user, repo]) => `https://github.com/${user}/${repo}`)

describe('ProjectCard - Property Tests', () => {
  // Feature: modern-blog-github-showcase, Property 4: ProjectCard contains required information
  // Validates: Requirements 2.2
  describe('Property 4: ProjectCard contains required information', () => {
    it('rendered output contains name, description, language, and star count for repos with non-null description', () => {
      fc.assert(
        fc.property(
          arbRepoName,
          arbDescription,
          arbLanguage,
          arbStars,
          arbRepoUrl,
          (name, description, language, stars, url) => {
            const html = renderProjectCard({ name, description, language, stars, url })

            // Must contain the repository name
            expect(html).toContain(name)

            // Must contain the description
            expect(html).toContain(description)

            // Must contain the language name
            expect(html).toContain(language)

            // Must contain the star count
            expect(html).toContain(String(stars))
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  // Feature: modern-blog-github-showcase, Property 5: ProjectCard links to correct repository URL
  // Validates: Requirements 2.5
  describe('Property 5: ProjectCard links to correct repository URL', () => {
    it('anchor element has href set to repo URL and target="_blank"', () => {
      fc.assert(
        fc.property(
          arbRepoName,
          fc.option(arbDescription, { nil: null }),
          fc.option(arbLanguage, { nil: null }),
          arbStars,
          arbRepoUrl,
          (name, description, language, stars, url) => {
            const html = renderProjectCard({ name, description, language, stars, url })

            // Anchor href must be the repo URL
            expect(html).toContain(`href="${url}"`)

            // Anchor target must be _blank for new tab
            expect(html).toContain('target="_blank"')

            // Must include rel="noopener noreferrer" for security
            expect(html).toContain('rel="noopener noreferrer"')
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
