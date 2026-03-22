// Build-time fetcher for Giscus discussion comments via GitHub GraphQL API

import { GISCUS_REPO, GISCUS_THOUGHT_CATEGORY } from '../consts';

export interface CommentAuthor {
  login: string;
  avatarUrl: string;
}

export interface CommentPreview {
  author: CommentAuthor;
  bodyText: string;
  createdAt: string;
}

export interface ThoughtCommentData {
  commentCount: number;
  comments: CommentPreview[];
}

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const PREVIEW_COUNT = 3;

interface GQLComment {
  author: { login: string; avatarUrl: string };
  bodyText: string;
  createdAt: string;
}

interface GQLDiscussion {
  title: string;
  comments: {
    totalCount: number;
    nodes: GQLComment[];
  };
}

interface GQLSearchResult {
  search: {
    nodes: GQLDiscussion[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// Build-time cache to avoid redundant API calls across multiple getStaticPaths
let _cache: Map<string, ThoughtCommentData> | null = null;

/**
 * Fetch all thought discussions from Giscus category via GitHub GraphQL API.
 * Returns a map from thought ID to comment data.
 * Memoized per build — safe to call from multiple getStaticPaths.
 * Gracefully returns empty map when no token is available (local dev).
 */
export async function fetchThoughtComments(): Promise<Map<string, ThoughtCommentData>> {
  if (_cache) return _cache;

  const token = getGitHubToken();
  if (!token) {
    console.info('[giscus-comments] No GITHUB_TOKEN, skipping comment fetch');
    _cache = new Map();
    return _cache;
  }

  const result = new Map<string, ThoughtCommentData>();

  try {
    let hasNext = true;
    let cursor: string | null = null;

    while (hasNext) {
      const data = await queryDiscussions(token, cursor);
      for (const disc of data.search.nodes) {
        // Discussion title matches thought ID (Giscus pathname mapping)
        const thoughtId = extractThoughtId(disc.title);
        if (!thoughtId) continue;

        result.set(thoughtId, {
          commentCount: disc.comments.totalCount,
          comments: disc.comments.nodes.map((c) => ({
            author: { login: c.author.login, avatarUrl: c.author.avatarUrl },
            bodyText: c.bodyText.slice(0, 120),
            createdAt: c.createdAt,
          })),
        });
      }

      hasNext = data.search.pageInfo.hasNextPage;
      cursor = data.search.pageInfo.endCursor;
    }
  } catch (err) {
    console.error('[giscus-comments] Failed to fetch:', err);
  }

  _cache = result;
  return result;
}

function getGitHubToken(): string | undefined {
  // Astro exposes env via import.meta.env at build time
  // Also check process.env for CI environments
  return (
    (import.meta as any).env?.GITHUB_TOKEN ??
    process.env.GITHUB_TOKEN ??
    undefined
  );
}

/**
 * Extract thought ID from discussion title.
 * Giscus uses pathname as title, e.g. "thoughts/2026-03-22-144702/"
 */
function extractThoughtId(title: string): string | null {
  const match = title.match(/thoughts\/([^/]+)/);
  return match ? match[1] : null;
}

async function queryDiscussions(
  token: string,
  after: string | null,
): Promise<GQLSearchResult> {
  const query = `
    query($searchQuery: String!, $after: String) {
      search(type: DISCUSSION, query: $searchQuery, first: 50, after: $after) {
        nodes {
          ... on Discussion {
            title
            comments(first: ${PREVIEW_COUNT}) {
              totalCount
              nodes {
                author { login avatarUrl }
                bodyText
                createdAt
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        searchQuery: `repo:${GISCUS_REPO} category:"${GISCUS_THOUGHT_CATEGORY}"`,
        after,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL API returned ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: any) => e.message).join(', '));
  }

  return json.data;
}
