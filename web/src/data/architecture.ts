// Architecture diagram data — layered dependency graph of the project

export type ArchLayer = 'pages' | 'components' | 'editor-ui' | 'lib' | 'api' | 'data' | 'build';

export interface ArchNode {
  id: string;
  name: string;
  icon: string;
  layer: ArchLayer;
  /** Only active in editor/dev mode */
  editorOnly?: boolean;
  url?: string;
}

export interface ArchEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ArchLayerDef {
  id: ArchLayer;
  name: string;
  icon: string;
  accent: string;
  accentMuted: string;
  border: string;
}

export interface ArchitectureData {
  layers: readonly ArchLayerDef[];
  nodes: readonly ArchNode[];
  edges: readonly ArchEdge[];
}

/** Persisted layout data from diagram-layout.json */
export interface DiagramLayoutData {
  groups?: Record<string, { x: number; y: number }>;
  edges?: Record<string, { bypassK: number }>;
}

export const architectureData: ArchitectureData = {
  layers: [
    { id: 'pages', name: 'Pages', icon: '📄', accent: '#3b82f6', accentMuted: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
    { id: 'components', name: 'Components', icon: '🧱', accent: '#10b981', accentMuted: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
    { id: 'editor-ui', name: 'Editor UI', icon: '✏️', accent: '#f59e0b', accentMuted: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    { id: 'lib', name: 'Libraries', icon: '📚', accent: '#8b5cf6', accentMuted: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
    { id: 'api', name: 'API Routes', icon: '🔌', accent: '#ec4899', accentMuted: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.25)' },
    { id: 'data', name: 'Data Sources', icon: '💾', accent: '#06b6d4', accentMuted: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.25)' },
    { id: 'build', name: 'Build & Infra', icon: '🏗️', accent: '#64748b', accentMuted: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)' },
  ],

  nodes: [
    // Pages layer — SSG pages served to visitors
    { id: 'page-home', name: '首页', icon: '🏠', layer: 'pages', url: '/' },
    { id: 'page-blog', name: '博客', icon: '✍️', layer: 'pages', url: '/blog' },
    { id: 'page-blog-post', name: '文章详情', icon: '📖', layer: 'pages', url: '/blog' },
    { id: 'page-thoughts', name: '想法', icon: '🧠', layer: 'pages', url: '/thoughts' },
    { id: 'page-friends', name: '友链', icon: '🤝', layer: 'pages', url: '/friends' },
    { id: 'page-wishes', name: '许愿', icon: '🌟', layer: 'pages', url: '/wishes' },
    { id: 'page-about', name: '关于', icon: '🙋', layer: 'pages', url: '/about' },
    { id: 'page-projects', name: '项目', icon: '📦', layer: 'pages', url: '/projects' },
    { id: 'page-stats', name: '统计', icon: '📊', layer: 'pages', url: '/stats' },
    { id: 'page-arch', name: '架构图', icon: '🏗️', layer: 'pages', url: '/architecture' },
    { id: 'page-live-editor', name: 'Live Editor', icon: '📝', layer: 'pages', editorOnly: true, url: '/admin/live-editor' },

    // Components layer — reusable Astro/React components used by pages
    { id: 'comp-profile', name: 'ProfileSidebar', icon: '👤', layer: 'components' },
    { id: 'comp-thought-timeline', name: 'ThoughtTimeline', icon: '📜', layer: 'components' },
    { id: 'comp-thought-card', name: 'ThoughtCard', icon: '💬', layer: 'components' },
    { id: 'comp-friend-card', name: 'FriendCard', icon: '🤝', layer: 'components' },
    { id: 'comp-wish-timeline', name: 'WishTimeline', icon: '🌟', layer: 'components' },
    { id: 'comp-skill-tree', name: 'SkillTree', icon: '🌳', layer: 'components' },
    { id: 'comp-stats-dashboard', name: 'StatsDashboard', icon: '📊', layer: 'components' },
    { id: 'comp-github-calendar', name: 'GitHubCalendar', icon: '📅', layer: 'components' },
    { id: 'comp-project-card', name: 'ProjectCard', icon: '📦', layer: 'components' },
    { id: 'comp-giscus', name: 'Giscus', icon: '💬', layer: 'components' },
    { id: 'comp-tag-chip', name: 'TagChip', icon: '🏷️', layer: 'components' },
    { id: 'comp-series-nav', name: 'SeriesNav', icon: '📚', layer: 'components' },
    { id: 'comp-diagram', name: 'DiagramRenderer', icon: '🗺️', layer: 'components' },
    { id: 'comp-header', name: 'Header', icon: '🔝', layer: 'components' },
    { id: 'comp-footer', name: 'Footer', icon: '🔚', layer: 'components' },

    // Editor UI layer — React components for dev-mode editing
    { id: 'editor-live', name: 'LiveEditor', icon: '📝', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-thought', name: 'ThoughtEditor', icon: '💭', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-mdx', name: 'MdxEditor', icon: '📄', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-toolbar', name: 'Toolbar', icon: '🔧', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-preview', name: 'PreviewPanel', icon: '👁️', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-frontmatter', name: 'FrontmatterPanel', icon: '🏷️', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-asset', name: 'AssetPanel', icon: '🖼️', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-sticker', name: 'StickerPanel', icon: '🎨', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-ai', name: 'AIDiffPanel', icon: '🤖', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-git', name: 'GitCommitModal', icon: '📌', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-env', name: 'EnvConfigPanel', icon: '⚙️', layer: 'editor-ui', editorOnly: true },
    { id: 'editor-post-list', name: 'PostList', icon: '📋', layer: 'editor-ui', editorOnly: true },

    // Libraries layer — shared utilities and logic
    { id: 'lib-github', name: 'GitHub API', icon: '🐙', layer: 'lib' },
    { id: 'lib-reading-stats', name: 'Reading Stats', icon: '📖', layer: 'lib' },
    { id: 'lib-blog-tags', name: 'Blog Tags', icon: '🏷️', layer: 'lib' },
    { id: 'lib-blog-series', name: 'Blog Series', icon: '📚', layer: 'lib' },
    { id: 'lib-blog-hero', name: 'Blog Hero', icon: '🖼️', layer: 'lib' },
    { id: 'lib-friends', name: 'Friend Links', icon: '🔗', layer: 'lib' },
    { id: 'lib-thoughts', name: 'Thought Utils', icon: '💭', layer: 'lib' },
    { id: 'lib-wishes', name: 'Wish Utils', icon: '🌟', layer: 'lib' },
    { id: 'lib-markdown', name: 'Markdown', icon: '📝', layer: 'lib' },
    { id: 'lib-editor-utils', name: 'Editor Utils', icon: '🔧', layer: 'lib', editorOnly: true },
    { id: 'lib-editor-shortcuts', name: 'Editor Shortcuts', icon: '⌨️', layer: 'lib', editorOnly: true },
    { id: 'lib-editor-formatting', name: 'Editor Formatting', icon: '✏️', layer: 'lib', editorOnly: true },
    { id: 'lib-frontmatter-utils', name: 'Frontmatter Utils', icon: '🏷️', layer: 'lib', editorOnly: true },
    { id: 'lib-diagram-layout', name: 'Diagram Layout', icon: '📐', layer: 'lib' },
    { id: 'lib-remark-sticker', name: 'Remark Sticker', icon: '🎨', layer: 'lib' },

    // API Routes layer — dev-mode server endpoints
    { id: 'api-posts', name: 'Posts API', icon: '🔗', layer: 'api', editorOnly: true },
    { id: 'api-thoughts', name: 'Thoughts API', icon: '🔗', layer: 'api', editorOnly: true },
    { id: 'api-assets', name: 'Assets API', icon: '🔗', layer: 'api', editorOnly: true },
    { id: 'api-stickers', name: 'Stickers API', icon: '🔗', layer: 'api', editorOnly: true },
    { id: 'api-ai', name: 'AI API', icon: '🔗', layer: 'api', editorOnly: true },
    { id: 'api-git', name: 'Git API', icon: '🔗', layer: 'api', editorOnly: true },
    { id: 'api-env', name: 'Env API', icon: '🔗', layer: 'api', editorOnly: true },
    { id: 'api-diagram', name: 'Diagram API', icon: '🔗', layer: 'api', editorOnly: true },

    // Data Sources layer — file system and external data
    { id: 'data-posts', name: 'Posts (MDX)', icon: '📁', layer: 'data' },
    { id: 'data-thoughts', name: 'Thoughts (YAML)', icon: '📁', layer: 'data' },
    { id: 'data-friends', name: 'Friends (YAML)', icon: '📁', layer: 'data' },
    { id: 'data-wishes', name: 'Wishes (YAML)', icon: '📁', layer: 'data' },
    { id: 'data-stickers', name: 'Stickers', icon: '🎭', layer: 'data' },
    { id: 'data-github', name: 'GitHub REST', icon: '🐙', layer: 'data' },
    { id: 'data-skills', name: 'Skill Tree', icon: '🌳', layer: 'data' },

    // Build & Infra layer
    { id: 'build-astro', name: 'Astro SSG', icon: '🚀', layer: 'build' },
    { id: 'build-dev', name: 'Dev Server', icon: '🔥', layer: 'build', editorOnly: true },
    { id: 'build-tokens', name: 'Design Tokens', icon: '🎨', layer: 'build' },
    { id: 'build-tailwind', name: 'Tailwind CSS', icon: '💨', layer: 'build' },
    { id: 'build-mdx', name: 'MDX + Expressive Code', icon: '📝', layer: 'build' },
    { id: 'build-rss', name: 'RSS Feed', icon: '📡', layer: 'build', url: '/rss.xml' },
    { id: 'build-og', name: 'OG Images', icon: '🖼️', layer: 'build' },
    { id: 'build-sitemap', name: 'Sitemap', icon: '🗺️', layer: 'build' },
  ],

  edges: [
    // Pages -> Components
    { source: 'page-home', target: 'comp-profile' },
    { source: 'page-home', target: 'comp-project-card' },
    { source: 'page-home', target: 'comp-github-calendar' },
    { source: 'page-blog', target: 'comp-tag-chip' },
    { source: 'page-blog-post', target: 'comp-giscus' },
    { source: 'page-blog-post', target: 'comp-series-nav' },
    { source: 'page-thoughts', target: 'comp-thought-timeline' },
    { source: 'page-thoughts', target: 'editor-thought', label: 'dev' },
    { source: 'page-friends', target: 'comp-friend-card' },
    { source: 'page-wishes', target: 'comp-wish-timeline' },
    { source: 'page-about', target: 'comp-profile' },
    { source: 'page-about', target: 'comp-github-calendar' },
    { source: 'page-projects', target: 'comp-project-card' },
    { source: 'page-stats', target: 'comp-stats-dashboard' },
    { source: 'page-stats', target: 'comp-skill-tree' },
    { source: 'page-arch', target: 'comp-diagram' },
    { source: 'page-live-editor', target: 'editor-live' },

    // Components -> Components
    { source: 'comp-thought-timeline', target: 'comp-thought-card' },

    // Components -> Libraries
    { source: 'comp-profile', target: 'lib-github' },
    { source: 'comp-github-calendar', target: 'lib-github' },
    { source: 'comp-stats-dashboard', target: 'lib-reading-stats' },
    { source: 'comp-thought-card', target: 'lib-markdown' },
    { source: 'comp-diagram', target: 'lib-diagram-layout' },
    { source: 'comp-skill-tree', target: 'data-skills' },

    // Editor UI composition
    { source: 'editor-live', target: 'editor-mdx' },
    { source: 'editor-live', target: 'editor-toolbar' },
    { source: 'editor-live', target: 'editor-preview' },
    { source: 'editor-live', target: 'editor-frontmatter' },
    { source: 'editor-live', target: 'editor-asset' },
    { source: 'editor-live', target: 'editor-sticker' },
    { source: 'editor-live', target: 'editor-ai' },
    { source: 'editor-live', target: 'editor-git' },
    { source: 'editor-live', target: 'editor-env' },
    { source: 'editor-live', target: 'editor-post-list' },
    { source: 'editor-thought', target: 'editor-sticker' },

    // Editor UI -> Libraries
    { source: 'editor-mdx', target: 'lib-editor-utils' },
    { source: 'editor-mdx', target: 'lib-editor-shortcuts' },
    { source: 'editor-mdx', target: 'lib-editor-formatting' },
    { source: 'editor-frontmatter', target: 'lib-frontmatter-utils' },

    // Editor UI -> API Routes
    { source: 'editor-post-list', target: 'api-posts' },
    { source: 'editor-thought', target: 'api-thoughts' },
    { source: 'editor-asset', target: 'api-assets' },
    { source: 'editor-sticker', target: 'api-stickers' },
    { source: 'editor-ai', target: 'api-ai' },
    { source: 'editor-git', target: 'api-git' },
    { source: 'editor-env', target: 'api-env' },
    { source: 'comp-diagram', target: 'api-diagram', label: 'dev' },

    // Libraries -> Data Sources
    { source: 'lib-github', target: 'data-github' },
    { source: 'lib-reading-stats', target: 'data-posts' },
    { source: 'lib-blog-tags', target: 'data-posts' },
    { source: 'lib-blog-series', target: 'data-posts' },
    { source: 'lib-blog-hero', target: 'data-posts' },
    { source: 'lib-friends', target: 'data-friends' },
    { source: 'lib-thoughts', target: 'data-thoughts' },
    { source: 'lib-wishes', target: 'data-wishes' },
    { source: 'lib-remark-sticker', target: 'data-stickers' },

    // API Routes -> Data Sources
    { source: 'api-posts', target: 'data-posts' },
    { source: 'api-thoughts', target: 'data-thoughts' },
    { source: 'api-assets', target: 'data-posts' },
    { source: 'api-stickers', target: 'data-stickers' },
    { source: 'api-git', target: 'data-posts' },
    { source: 'api-git', target: 'data-thoughts' },

    // Pages -> Libraries (direct)
    { source: 'page-blog', target: 'lib-blog-tags' },
    { source: 'page-blog', target: 'lib-blog-series' },
    { source: 'page-blog-post', target: 'lib-blog-hero' },
    { source: 'page-blog-post', target: 'lib-reading-stats' },
    { source: 'page-blog-post', target: 'lib-remark-sticker' },
    { source: 'page-friends', target: 'lib-friends' },
    { source: 'page-thoughts', target: 'lib-thoughts' },
    { source: 'page-wishes', target: 'lib-wishes' },

    // Pages -> Data Sources (direct via Astro content collections)
    { source: 'page-blog', target: 'data-posts' },
    { source: 'page-blog-post', target: 'data-posts' },
    { source: 'page-home', target: 'data-posts' },

    // Build layer connections
    { source: 'build-astro', target: 'build-mdx' },
    { source: 'build-astro', target: 'build-tailwind' },
    { source: 'build-astro', target: 'build-tokens' },
    { source: 'build-astro', target: 'build-rss' },
    { source: 'build-astro', target: 'build-og' },
    { source: 'build-astro', target: 'build-sitemap' },
    { source: 'build-dev', target: 'build-astro' },
    { source: 'build-mdx', target: 'lib-remark-sticker' },
    { source: 'build-tailwind', target: 'build-tokens' },
  ],
};
