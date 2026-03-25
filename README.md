# B3n1gn X · 个人博客

基于 [Astro](https://astro.build) 构建的静态个人博客，新拟态（Neumorphism）设计风格，集成 GitHub 项目展示、MDX 文章、想法碎碎念、分享卡片、在线编辑器等功能。

**在线访问：** [benign.host](https://benign.host)

---

## 快速开始

**依赖要求：** [Bun](https://bun.sh) >= 1.0.0（本项目只支持 bun）

```bash
cd web
bun install
bun run dev          # 开发服务器
bun run dev:editor   # 带在线编辑器的开发服务器
bun run build        # 生产构建
bun run preview      # 预览构建结果
bun run quality      # 运行质量检查（token/contrast/aria/import/hardcoded 等）
```

---

## 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 首页 — GitHub 资料、置顶项目、近期文章、近期想法 |
| `/blog` | 博客文章列表（支持分类/标签/系列/归档筛选） |
| `/blog/[slug]` | 文章详情页（带分享卡片、阅读进度条） |
| `/thoughts` | 想法列表（懒加载、标签筛选、热力图） |
| `/thoughts/[id]` | 想法详情页（带分享卡片） |
| `/about` | 关于页面 — 个人信息、GitHub 活动日历、技能树、统计面板 |
| `/stats` | 博客统计 |
| `/friends` | 友链 |
| `/wishes` | 心愿清单 |
| `/projects` | 开源项目展示 |
| `/architecture` | 架构图 |
| `/rss.xml` | RSS 订阅（含文章 + 想法） |
| `/admin/live-editor` | 在线编辑器（仅 `dev:editor` 模式） |

---

## 站点配置

编辑 `web/src/consts.ts`，所有站点信息集中在这里：

```ts
export const USER_NAME = 'your-github-username';
export const NICK_NAME = '你的昵称';
export const SITE_TITLE = '网站标题';
export const SITE_DESCRIPTION = '网站描述';
export const SITE_URL = 'https://your-domain.com';
export const SITE_LANG = 'zh-CN';
export const NICK_ALIASES = ['别名1', '别名2'];  // SEO 名称变体
export const PINNED_PROJECTS = ['repo1', 'repo2'];
export const SOCIALS = [/* ... */];
// Giscus、GA4 等配置也在这里
```

路径别名：`~/` → `web/src/`，`@assets/` → `assets/`

---

## 写文章

文章放在 `posts/<slug>/index.mdx`，每篇一个目录，图片放同目录下。

```yaml
---
title: '文章标题'
description: '文章描述'
pubDate: 'Jan 1 2025'
updatedDate: 'Feb 1 2025'       # 可选
heroImage: './your-image.png'    # 可选封面图
tags: ['tag1', 'tag2']
category: '分类'
series: 'series-slug'            # 可选系列
seriesOrder: 1                   # 可选系列排序
---
```

没有 `heroImage` 时自动从正文提取第一张图片，都没有则根据标题生成渐变色封面。

---

## 想法（Thoughts）

YAML 文件放在 `thoughts/` 目录，格式：

```yaml
content: '想法内容，支持 **markdown** 和 :sticker[name]: 语法'
createdAt: '2025-01-01T12:00:00'
tags: ['标签']
mood: '🎉'
```

---

## 分享卡片

文章和想法详情页有「📤 分享」按钮，点击后在浏览器端用 Canvas 合成：OG 图片 + 底部信息栏（标题 + 二维码 + 头像），支持复制到剪贴板和下载。

---

## 在线编辑器

```bash
bun run dev:editor
```

功能：文章 CRUD、实时预览、资源管理、格式化工具栏、AI 辅助（润色/翻译/续写）、Git 提交、微信公众号导出。

AI 功能需在 `web/.env` 配置 OpenAI 兼容 API，未配置时自动隐藏。

---

## 质量检查

```bash
bun run quality
```

包含 9 项检查：Token 完整性、Token 使用、WCAG 对比度、Aria 标签、CSS 质量、内容校验、Import 规范、硬编码字符串、Bundle 大小。

---

## 项目结构

```
├── posts/                     # 文章（.mdx）
├── thoughts/                  # 想法（.yaml）
├── friends/                   # 友链（.yaml）
├── wishes/                    # 心愿（.yaml）
├── assets/                    # 全局静态资源（图片、贴纸）
├── web/
│   ├── public/                # 静态文件（字体、社交图标、CSS）
│   ├── scripts/               # 质量检查脚本
│   └── src/
│       ├── components/
│       │   ├── layout/        # Header, Footer, Sidebar, BaseHead, ThemeToggle
│       │   ├── blog/          # BlogSidebar, ArticleTOC, SeriesNav, TagChip...
│       │   ├── thought/       # ThoughtCard, ThoughtTimeline...
│       │   ├── profile/       # ProfileSidebar, StatsDashboard, SkillTree...
│       │   ├── search/        # SearchDialog, SearchTrigger
│       │   ├── shared/        # FormattedDate, Giscus, ShareCard, FriendCard...
│       │   └── editor/
│       │       ├── shared/    # editor-tokens, StickerPanel
│       │       ├── thought/   # Editor, Preview, use-api, use-draft
│       │       └── post/      # Live, Mdx, Toolbar, PostList, panels/
│       ├── lib/
│       │   ├── blog/          # archive, series, tags, hero, related, filter
│       │   ├── search/        # engine, highlight
│       │   ├── markdown/      # rehype/remark plugins
│       │   └── editor/        # formatting, shortcuts, utils, routes/
│       ├── data/              # thoughts, friends, wishes, schemas, yaml-loader
│       ├── pages/             # 路由页面
│       ├── layouts/           # BlogPost, WithSidebar
│       ├── styles/            # tokens.css, neumorphism.css, animations.css...
│       └── types/             # TypeScript 类型
└── .github/workflows/         # GitHub Actions 部署
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Astro 5 + React 19 |
| 样式 | Tailwind CSS 4 + 新拟态设计系统 |
| 编辑器 | CodeMirror 6 |
| 内容 | MDX + Astro Content Collections |
| 代码高亮 | Expressive Code (Starlight) |
| 图表 | Mermaid |
| OG 图片 | Satori + Resvg（构建时生成） |
| 搜索 | MiniSearch（全站搜索） |
| 评论 | Giscus |
| 包管理 | Bun |
| 测试 | Vitest |
| 部署 | GitHub Actions → GitHub Pages |

---

## 部署

推送到 `main` 分支自动触发 GitHub Actions 构建部署。部署前修改 `web/astro.config.mjs` 中的 `site` 和 `web/src/consts.ts` 中的站点信息。

---

## 测试

```bash
cd web
bunx --bun vitest run
```
