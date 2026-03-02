import { USER_NAME, NICK_NAME } from '../consts'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// File-based cache persisted to .astro/github-cache.json
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const cacheDir = join(dirname(fileURLToPath(import.meta.url)), '../../.astro')
const cacheFile = join(cacheDir, 'github-cache.json')

interface CacheEntry { data: unknown; expiry: number }
type CacheStore = Record<string, CacheEntry>

// Allow tests to bypass cache
let _cacheDisabled = false
export function _disableCache() { _cacheDisabled = true }
export function _enableCache() { _cacheDisabled = false }

function readCache(): CacheStore {
  if (_cacheDisabled) return {}
  try {
    return JSON.parse(readFileSync(cacheFile, 'utf-8'))
  } catch {
    return {}
  }
}

function writeCache(store: CacheStore): void {
  if (_cacheDisabled) return
  try {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(cacheFile, JSON.stringify(store, null, 2))
  } catch {
    // Write failure is non-critical
  }
}

// Build common headers for GitHub API requests
function githubHeaders(username: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': `astro-blog-${username}`,
  }
  const token = import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const store = readCache()
  const cached = store[key]
  if (cached && Date.now() < cached.expiry) {
    return cached.data as T
  }
  const data = await fetcher()
  store[key] = { data, expiry: Date.now() + CACHE_TTL }
  writeCache(store)
  return data
}

// GitHub user profile data model
export interface GitHubProfile {
  login: string
  avatar_url: string
  bio: string | null
  name: string | null
  location: string | null
  company: string | null
  blog: string | null
  followers: number
  following: number
  public_repos: number
}

// GitHub repository data model
export interface GitHubRepo {
  name: string
  description: string | null
  html_url: string
  language: string | null
  stargazers_count: number
  fork: boolean
}

// Fallback profile used when GitHub API is unavailable
export const FALLBACK_PROFILE: GitHubProfile = {
  login: USER_NAME,
  avatar_url: `https://github.com/${USER_NAME}.png`,
  bio: 'Overflow Stack Developer.',
  name: NICK_NAME,
  location: null,
  company: null,
  blog: null,
  followers: 0,
  following: 0,
  public_repos: 0,
}

// Fallback repos used when GitHub API is unavailable
export const FALLBACK_REPOS: GitHubRepo[] = []

// Fetch user profile from GitHub API
export async function fetchGitHubProfile(
  username: string = USER_NAME,
): Promise<GitHubProfile> {
  return cachedFetch(`profile:${username}`, async () => {
    try {
      const response = await fetch(
        `https://api.github.com/users/${username}`,
        { headers: githubHeaders(username) },
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      return {
        login: data.login,
        avatar_url: data.avatar_url,
        bio: data.bio,
        name: data.name,
        location: data.location,
        company: data.company,
        blog: data.blog,
        followers: data.followers,
        following: data.following,
        public_repos: data.public_repos,
      }
    } catch (error) {
      console.warn('Failed to fetch GitHub profile, using fallback:', error)
      return FALLBACK_PROFILE
    }
  })
}


// Fetch public repositories from GitHub API
export async function fetchGitHubRepos(
  username: string = USER_NAME,
): Promise<GitHubRepo[]> {
  return cachedFetch(`repos:${username}`, async () => {
    try {
      const response = await fetch(
        `https://api.github.com/users/${username}/repos?type=public&per_page=100&sort=stars&direction=desc`,
        { headers: githubHeaders(username) },
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data: GitHubRepo[] = await response.json()

      // Filter out forked repos, sort by stars descending, take first 12
      return data
        .filter((repo) => !repo.fork)
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 12)
    } catch (error) {
      console.warn('Failed to fetch GitHub repos, using fallback:', error)
      return FALLBACK_REPOS
    }
  })
}


// Featured project with banner and logo extracted from README
export interface FeaturedProject {
  name: string
  description: string | null
  html_url: string
  homepage: string | null
  language: string | null
  stargazers_count: number
  bannerUrl: string | null
  logoUrl: string | null
  owner: string
}

// Resolve a raw image URL to an absolute URL
function resolveImageUrl(rawUrl: string, owner: string, repo: string): string {
  if (rawUrl.startsWith('http')) return rawUrl
  const cleanPath = rawUrl.replace(/^\.?\//, '')
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${cleanPath}`
}

// Heuristic: classify an image as logo or banner based on alt text and path
function isLogoImage(alt: string, url: string): boolean {
  const lowerAlt = alt.toLowerCase()
  const lowerUrl = url.toLowerCase()
  return /logo|icon|badge|avatar|favicon/.test(lowerAlt) || /logo|icon/.test(lowerUrl)
}

// Extract images from README, classifying them as banner or logo
export interface ReadmeImages {
  bannerUrl: string | null
  logoUrl: string | null
}

export function extractImagesFromReadme(readme: string, owner: string, repo: string): ReadmeImages {
  const result: ReadmeImages = { bannerUrl: null, logoUrl: null }

  // Collect all markdown images: ![alt](url)
  const mdImages = [...readme.matchAll(/!\[(.*?)\]\((.*?)\)/g)]
  // Collect all HTML images: <img ... src="url" ... alt="alt">
  const htmlImages = [...readme.matchAll(/<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]

  interface ImageInfo { alt: string; url: string }
  const allImages: ImageInfo[] = []

  for (const m of mdImages) {
    allImages.push({ alt: m[1] || '', url: m[2] })
  }
  for (const m of htmlImages) {
    const altMatch = m[0].match(/\balt=["']([^"']*)["']/)
    allImages.push({ alt: altMatch?.[1] || '', url: m[1] })
  }

  // Skip badge/CI/chart images but keep normal SVG logos
  const filtered = allImages.filter(img => {
    const u = img.url.toLowerCase()
    return !u.includes('shields.io') && !u.includes('badge') && !u.includes('codecov')
      && !u.includes('travis-ci') && !u.includes('ci.appveyor.com')
      && !u.includes('github.com/workflows') && !u.includes('coveralls.io')
      && !u.includes('star-history.com') && !u.includes('starchart.cc')
      && !u.includes('github-readme-stats') && !u.includes('contrib.rocks')
  })

  for (const img of filtered) {
    const resolved = resolveImageUrl(img.url, owner, repo)
    if (isLogoImage(img.alt, img.url)) {
      if (!result.logoUrl) result.logoUrl = resolved
    } else {
      if (!result.bannerUrl) result.bannerUrl = resolved
    }
  }

  return result
}

// Backward-compatible wrapper
export function extractBannerFromReadme(readme: string, owner: string, repo: string): string | null {
  return extractImagesFromReadme(readme, owner, repo).bannerUrl
}

// Fetch featured project details including banner from README
export async function fetchFeaturedProjects(
  pinnedRepos: string[],
  username: string = USER_NAME,
): Promise<FeaturedProject[]> {
  return cachedFetch(`featured:${pinnedRepos.join(',')}`, async () => {
    const headers = githubHeaders(username)

    const projects = await Promise.all(
      pinnedRepos.map(async (repoSpec): Promise<FeaturedProject | null> => {
        try {
          const [owner, repo] = repoSpec.includes('/')
            ? repoSpec.split('/')
            : [username, repoSpec]

          // Fetch repo metadata
          const repoRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            { headers },
          )
          if (!repoRes.ok) throw new Error(`Repo API error: ${repoRes.status}`)
          const repoData = await repoRes.json()

          // Fetch README content for banner/logo extraction
          let bannerUrl: string | null = null
          let logoUrl: string | null = null
          try {
            const readmeRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/readme`,
              { headers: { ...headers, Accept: 'application/vnd.github.v3.raw' } },
            )
            if (readmeRes.ok) {
              const readmeText = await readmeRes.text()
              const images = extractImagesFromReadme(readmeText, owner, repo)
              bannerUrl = images.bannerUrl
              logoUrl = images.logoUrl
            }
          } catch {
            // README fetch failure is non-critical
          }

          return {
            name: repoData.name,
            description: repoData.description,
            html_url: repoData.html_url,
            homepage: repoData.homepage || null,
            language: repoData.language,
            stargazers_count: repoData.stargazers_count,
            bannerUrl,
            logoUrl,
            owner,
          }
        } catch (error) {
          console.warn(`Failed to fetch featured project ${repoSpec}:`, error)
          return null
        }
      }),
    )

    return projects.filter((p): p is FeaturedProject => p !== null)
  })
}
