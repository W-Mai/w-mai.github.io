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

