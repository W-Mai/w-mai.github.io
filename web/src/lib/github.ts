import { USER_NAME, NICK_NAME } from '../consts'

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
  try {
    const response = await fetch(
      `https://api.github.com/users/${username}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': `astro-blog-${username}`,
        },
      },
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
}


// Fetch public repositories from GitHub API
export async function fetchGitHubRepos(
  username: string = USER_NAME,
): Promise<GitHubRepo[]> {
  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?type=public&per_page=100&sort=stars&direction=desc`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': `astro-blog-${username}`,
        },
      },
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
}


// Featured project with banner/logo extracted from README
export interface FeaturedProject {
  name: string
  description: string | null
  html_url: string
  language: string | null
  stargazers_count: number
  bannerUrl: string | null
  owner: string
}

// Extract the first image URL from README markdown content
export function extractBannerFromReadme(readme: string, owner: string, repo: string): string | null {
  // Match markdown image syntax: ![alt](url) or HTML <img src="url">
  const mdImageMatch = readme.match(/!\[.*?\]\((.*?)\)/)
  const htmlImageMatch = readme.match(/<img[^>]+src=["']([^"']+)["']/)

  const rawUrl = mdImageMatch?.[1] || htmlImageMatch?.[1] || null
  if (!rawUrl) return null

  // Convert relative URLs to absolute GitHub raw URLs
  if (rawUrl.startsWith('http')) return rawUrl
  const cleanPath = rawUrl.replace(/^\.?\//, '')
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${cleanPath}`
}

// Fetch featured project details including banner from README
export async function fetchFeaturedProjects(
  pinnedRepos: string[],
  username: string = USER_NAME,
): Promise<FeaturedProject[]> {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': `astro-blog-${username}`,
  }

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

        // Fetch README content
        let bannerUrl: string | null = null
        try {
          const readmeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/readme`,
            { headers: { ...headers, Accept: 'application/vnd.github.v3.raw' } },
          )
          if (readmeRes.ok) {
            const readmeText = await readmeRes.text()
            bannerUrl = extractBannerFromReadme(readmeText, owner, repo)
          }
        } catch {
          // README fetch failure is non-critical
        }

        return {
          name: repoData.name,
          description: repoData.description,
          html_url: repoData.html_url,
          language: repoData.language,
          stargazers_count: repoData.stargazers_count,
          bannerUrl,
          owner,
        }
      } catch (error) {
        console.warn(`Failed to fetch featured project ${repoSpec}:`, error)
        return null
      }
    }),
  )

  return projects.filter((p): p is FeaturedProject => p !== null)
}
