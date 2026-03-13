// Architecture diagram data — static definition of project modules and data flow

export interface ArchNode {
  id: string;
  name: string;
  icon: string;
  group: string;
  url?: string;
  modes: readonly ('publish' | 'editor')[];
}

export interface ArchEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ArchGroupTheme {
  accent: string;      // primary accent color
  accentMuted: string; // softer version for backgrounds
  border: string;      // border color for group container
  bg: string;          // semi-transparent background
  gradient: string;    // gradient for node left-bar
}

export interface ArchGroup {
  id: string;
  name: string;
  icon: string;
  theme: ArchGroupTheme;
}

export interface ArchitectureData {
  groups: readonly ArchGroup[];
  nodes: readonly ArchNode[];
  edges: readonly ArchEdge[];
}

/** Persisted group positions from diagram-layout.json */
export interface DiagramLayoutData {
  groups?: Record<string, { x: number; y: number }>;
}

export const architectureData = {
  groups: [
    {
      id: 'pages', name: 'Pages', icon: '📄',
      theme: {
        accent: '#3b82f6', accentMuted: 'rgba(59,130,246,0.08)',
        border: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.04)',
        gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
      },
    },
    {
      id: 'editor', name: 'Editor', icon: '✏️',
      theme: {
        accent: '#f59e0b', accentMuted: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.04)',
        gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
      },
    },
    {
      id: 'api', name: 'API Routes', icon: '🔌',
      theme: {
        accent: '#8b5cf6', accentMuted: 'rgba(139,92,246,0.08)',
        border: 'rgba(139,92,246,0.3)', bg: 'rgba(139,92,246,0.04)',
        gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
      },
    },
    {
      id: 'data', name: 'Data Sources', icon: '💾',
      theme: {
        accent: '#10b981', accentMuted: 'rgba(16,185,129,0.08)',
        border: 'rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.04)',
        gradient: 'linear-gradient(135deg, #10b981, #34d399)',
      },
    },
    {
      id: 'build', name: 'Build & Styles', icon: '🏗️',
      theme: {
        accent: '#06b6d4', accentMuted: 'rgba(6,182,212,0.08)',
        border: 'rgba(6,182,212,0.3)', bg: 'rgba(6,182,212,0.04)',
        gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
      },
    },
  ],

  nodes: [
    // Pages — ordered to align with Data sources connections
    { id: 'page-blog', name: '博客', icon: '✍️', group: 'pages', url: '/blog', modes: ['publish', 'editor'] },
    { id: 'page-home', name: '当门', icon: '🏠', group: 'pages', url: '/', modes: ['publish', 'editor'] },
    { id: 'page-thoughts', name: '想法', icon: '🧠', group: 'pages', url: '/thoughts', modes: ['publish', 'editor'] },
    { id: 'page-friends', name: '友链', icon: '🤝', group: 'pages', url: '/friends', modes: ['publish', 'editor'] },
    { id: 'page-wishes', name: '许愿', icon: '🌟', group: 'pages', url: '/wishes', modes: ['publish', 'editor'] },
    { id: 'page-about', name: '自个儿', icon: '🙋', group: 'pages', url: '/about', modes: ['publish', 'editor'] },
    { id: 'page-projects', name: '项目', icon: '📦', group: 'pages', url: '/projects', modes: ['publish', 'editor'] },
    { id: 'page-stats', name: '统计', icon: '📊', group: 'pages', url: '/stats', modes: ['publish', 'editor'] },

    // Editor components — ordered by dependency alignment with API group
    { id: 'editor-live', name: 'Live Editor', icon: '📝', group: 'editor', url: '/admin/live-editor', modes: ['editor'] },
    { id: 'editor-mdx', name: 'MDX Editor', icon: '📄', group: 'editor', modes: ['editor'] },
    { id: 'editor-thought', name: 'Thought Editor', icon: '💭', group: 'editor', modes: ['editor'] },
    { id: 'editor-asset', name: 'Asset Manager', icon: '🖼️', group: 'editor', modes: ['editor'] },
    { id: 'editor-sticker', name: 'Sticker Panel', icon: '🎨', group: 'editor', modes: ['editor'] },
    { id: 'editor-ai', name: 'AI Diff Panel', icon: '🤖', group: 'editor', modes: ['editor'] },
    { id: 'editor-git', name: 'Git Commit', icon: '📌', group: 'editor', modes: ['editor'] },
    { id: 'editor-frontmatter', name: 'Frontmatter Panel', icon: '🏷️', group: 'editor', modes: ['editor'] },

    // API routes — ordered to align with editor connections
    // editor-live has no API edge, so api-posts aligns with editor-mdx (row 1)
    { id: 'api-posts', name: 'Posts API', icon: '🔗', group: 'api', modes: ['editor'] },
    { id: 'api-thoughts', name: 'Thoughts API', icon: '🔗', group: 'api', modes: ['editor'] },
    { id: 'api-assets', name: 'Assets API', icon: '🔗', group: 'api', modes: ['editor'] },
    { id: 'api-stickers', name: 'Stickers API', icon: '🔗', group: 'api', modes: ['editor'] },
    { id: 'api-ai', name: 'AI API', icon: '🔗', group: 'api', modes: ['editor'] },
    { id: 'api-git', name: 'Git API', icon: '🔗', group: 'api', modes: ['editor'] },
    { id: 'api-env', name: 'Env API', icon: '🔗', group: 'api', modes: ['editor'] },

    // Data sources — ordered to align with API and Pages connections
    { id: 'data-posts', name: 'Posts (MDX)', icon: '📁', group: 'data', modes: ['publish', 'editor'] },
    { id: 'data-thoughts', name: 'Thoughts (YAML)', icon: '📁', group: 'data', modes: ['publish', 'editor'] },
    { id: 'data-stickers', name: 'Stickers', icon: '🎭', group: 'data', modes: ['publish', 'editor'] },
    { id: 'data-friends', name: 'Friends (YAML)', icon: '📁', group: 'data', modes: ['publish', 'editor'] },
    { id: 'data-wishes', name: 'Wishes (YAML)', icon: '📁', group: 'data', modes: ['publish', 'editor'] },
    { id: 'data-github', name: 'GitHub API', icon: '🐙', group: 'data', modes: ['publish', 'editor'] },

    // Build system
    { id: 'build-astro', name: 'Astro SSG', icon: '🚀', group: 'build', modes: ['publish', 'editor'] },
    { id: 'build-tokens', name: 'Design Tokens', icon: '🎨', group: 'build', modes: ['publish', 'editor'] },
    { id: 'build-tailwind', name: 'Tailwind CSS', icon: '💨', group: 'build', modes: ['publish', 'editor'] },
    { id: 'build-rss', name: 'RSS Feed', icon: '📡', group: 'build', url: '/rss.xml', modes: ['publish', 'editor'] },
    { id: 'build-og', name: 'OG Images', icon: '🖼️', group: 'build', modes: ['publish', 'editor'] },
  ],

  edges: [
    // Pages → Data sources
    { source: 'page-blog', target: 'data-posts', label: 'MDX' },
    { source: 'page-thoughts', target: 'data-thoughts', label: 'YAML' },
    { source: 'page-friends', target: 'data-friends', label: 'YAML' },
    { source: 'page-wishes', target: 'data-wishes', label: 'YAML' },
    { source: 'page-about', target: 'data-github' },
    { source: 'page-projects', target: 'data-github' },
    { source: 'page-home', target: 'data-github' },
    { source: 'page-home', target: 'data-posts' },

    // Editor → API routes
    { source: 'editor-live', target: 'editor-mdx' },
    { source: 'editor-live', target: 'editor-frontmatter' },
    { source: 'editor-live', target: 'editor-asset' },
    { source: 'editor-live', target: 'editor-sticker' },
    { source: 'editor-live', target: 'editor-ai' },
    { source: 'editor-mdx', target: 'api-posts' },
    { source: 'editor-thought', target: 'api-thoughts' },
    { source: 'editor-asset', target: 'api-assets' },
    { source: 'editor-sticker', target: 'api-stickers' },
    { source: 'editor-ai', target: 'api-ai' },
    { source: 'editor-git', target: 'api-git' },

    // API → Data sources
    { source: 'api-posts', target: 'data-posts' },
    { source: 'api-thoughts', target: 'data-thoughts' },
    { source: 'api-assets', target: 'data-stickers' },
    { source: 'api-stickers', target: 'data-stickers' },

    // Build system connections
    { source: 'build-astro', target: 'data-posts' },
    { source: 'build-astro', target: 'data-thoughts' },
    { source: 'build-tokens', target: 'build-tailwind' },
    { source: 'build-rss', target: 'data-posts' },
    { source: 'build-og', target: 'data-posts' },

    // Thoughts page uses stickers
    { source: 'page-thoughts', target: 'data-stickers' },
  ],
} as const satisfies ArchitectureData;
