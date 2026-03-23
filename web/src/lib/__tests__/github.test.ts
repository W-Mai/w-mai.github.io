import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import {
  fetchGitHubProfile,
  fetchGitHubRepos,
  FALLBACK_PROFILE,
  FALLBACK_REPOS,
  _disableCache,
  _enableCache,
} from '../github'

// Arbitrary: generate a valid GitHubProfile-shaped API response
const arbGitHubProfileResponse = fc.record({
  login: fc.string({ minLength: 1, maxLength: 39 }).filter((s) => s.trim().length > 0),
  avatar_url: fc.webUrl(),
  bio: fc.option(fc.string(), { nil: null }),
  name: fc.option(fc.string(), { nil: null }),
  location: fc.option(fc.string(), { nil: null }),
  company: fc.option(fc.string(), { nil: null }),
  blog: fc.option(fc.string(), { nil: null }),
  followers: fc.nat(),
  following: fc.nat(),
  public_repos: fc.nat(),
})

// Arbitrary: generate a single GitHubRepo-shaped API response
const arbGitHubRepoResponse = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  description: fc.option(fc.string(), { nil: null }),
  html_url: fc.webUrl(),
  language: fc.option(fc.string(), { nil: null }),
  stargazers_count: fc.nat({ max: 1_000_000 }),
  fork: fc.boolean(),
  pushed_at: fc.integer({ min: 1577836800000, max: 1767139200000 }).map((ts) => new Date(ts).toISOString()),
})

// Arbitrary: generate a list of repos (0 to 50)
const arbGitHubRepoList = fc.array(arbGitHubRepoResponse, { minLength: 0, maxLength: 50 })

// Arbitrary: generate HTTP error status codes (4xx and 5xx)
const arbErrorStatusCode = fc.oneof(
  fc.integer({ min: 400, max: 499 }),
  fc.integer({ min: 500, max: 599 }),
)


describe('GitHub Data Fetcher - Property Tests', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    _disableCache()
  })

  afterEach(() => {
    _enableCache()
    globalThis.fetch = originalFetch
  })

  // Feature: modern-blog-github-showcase, Property 1: GitHub API response parsing round-trip
  // Validates: Requirements 1.1, 1.2
  describe('Property 1: GitHub API response parsing round-trip', () => {
    it('fetchGitHubProfile preserves all field values from API response', async () => {
      await fc.assert(
        fc.asyncProperty(arbGitHubProfileResponse, async (profileData) => {
          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(profileData),
          })

          const result = await fetchGitHubProfile('testuser')

          expect(result.login).toBe(profileData.login)
          expect(result.avatar_url).toBe(profileData.avatar_url)
          expect(result.bio).toBe(profileData.bio)
          expect(result.name).toBe(profileData.name)
          expect(result.location).toBe(profileData.location)
          expect(result.company).toBe(profileData.company)
          expect(result.blog).toBe(profileData.blog)
          expect(result.followers).toBe(profileData.followers)
          expect(result.following).toBe(profileData.following)
          expect(result.public_repos).toBe(profileData.public_repos)
        }),
        { numRuns: 100 },
      )
    })

    it('fetchGitHubRepos preserves all field values from API response for non-fork repos', async () => {
      await fc.assert(
        fc.asyncProperty(arbGitHubRepoList, async (repoData) => {
          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(repoData),
          })

          const result = await fetchGitHubRepos('testuser')
          const expectedNonForks = repoData.filter((r) => !r.fork)

          // Every returned repo should exist in the original non-fork set with matching fields
          for (const repo of result) {
            const original = expectedNonForks.find(
              (r) => r.name === repo.name && r.html_url === repo.html_url,
            )
            expect(original).toBeDefined()
            expect(repo.description).toBe(original!.description)
            expect(repo.language).toBe(original!.language)
            expect(repo.stargazers_count).toBe(original!.stargazers_count)
            expect(repo.fork).toBe(original!.fork)
            expect(repo.pushed_at).toBe(original!.pushed_at)
          }
        }),
        { numRuns: 100 },
      )
    })
  })

  // Feature: modern-blog-github-showcase, Property 2: Error fallback guarantees
  // Validates: Requirements 1.3
  describe('Property 2: Error fallback guarantees', () => {
    it('fetchGitHubProfile returns fallback for any HTTP error status', async () => {
      await fc.assert(
        fc.asyncProperty(arbErrorStatusCode, async (statusCode) => {
          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: statusCode,
            statusText: 'Error',
          })

          const result = await fetchGitHubProfile('testuser')
          expect(result).toEqual(FALLBACK_PROFILE)
        }),
        { numRuns: 100 },
      )
    })

    it('fetchGitHubRepos returns fallback for any HTTP error status', async () => {
      await fc.assert(
        fc.asyncProperty(arbErrorStatusCode, async (statusCode) => {
          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: statusCode,
            statusText: 'Error',
          })

          const result = await fetchGitHubRepos('testuser')
          expect(result).toEqual(FALLBACK_REPOS)
        }),
        { numRuns: 100 },
      )
    })

    it('fetchGitHubProfile returns fallback on network failure', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (errorMsg) => {
          globalThis.fetch = vi.fn().mockRejectedValue(new Error(errorMsg))

          const result = await fetchGitHubProfile('testuser')
          expect(result).toEqual(FALLBACK_PROFILE)
        }),
        { numRuns: 100 },
      )
    })

    it('fetchGitHubRepos returns fallback on network failure', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (errorMsg) => {
          globalThis.fetch = vi.fn().mockRejectedValue(new Error(errorMsg))

          const result = await fetchGitHubRepos('testuser')
          expect(result).toEqual(FALLBACK_REPOS)
        }),
        { numRuns: 100 },
      )
    })
  })

  // Feature: modern-blog-github-showcase, Property 3: Repository list invariants
  // Validates: Requirements 1.1, 1.2, 1.3
  describe('Property 3: Repository list invariants', () => {
    it('without limit: returns all non-forks sorted by stars desc with pushed_at secondary sort', async () => {
      await fc.assert(
        fc.asyncProperty(arbGitHubRepoList, async (repoData) => {
          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(repoData),
          })

          const result = await fetchGitHubRepos('testuser')
          const nonForkCount = repoData.filter((r) => !r.fork).length

          // Returns all non-forks
          expect(result.length).toBe(nonForkCount)

          // No forks
          for (const repo of result) {
            expect(repo.fork).toBe(false)
          }

          // Sorted by stargazers_count descending, pushed_at as tiebreaker
          for (let i = 1; i < result.length; i++) {
            const prev = result[i - 1]
            const curr = result[i]
            if (prev.stargazers_count === curr.stargazers_count) {
              expect(new Date(prev.pushed_at).getTime()).toBeGreaterThanOrEqual(
                new Date(curr.pushed_at).getTime(),
              )
            } else {
              expect(prev.stargazers_count).toBeGreaterThan(curr.stargazers_count)
            }
          }
        }),
        { numRuns: 100 },
      )
    })

    it('with limit: returns at most limit non-forks sorted by stars desc', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbGitHubRepoList,
          fc.integer({ min: 1, max: 50 }),
          async (repoData, limit) => {
            globalThis.fetch = vi.fn().mockResolvedValue({
              ok: true,
              json: () => Promise.resolve(repoData),
            })

            const result = await fetchGitHubRepos('testuser', limit)
            const nonForkCount = repoData.filter((r) => !r.fork).length

            // At most limit items
            expect(result.length).toBeLessThanOrEqual(limit)
            expect(result.length).toBe(Math.min(nonForkCount, limit))

            // No forks
            for (const repo of result) {
              expect(repo.fork).toBe(false)
            }

            // Sorted by stargazers_count descending
            for (let i = 1; i < result.length; i++) {
              expect(result[i - 1].stargazers_count).toBeGreaterThanOrEqual(
                result[i].stargazers_count,
              )
            }
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
