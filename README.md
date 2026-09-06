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
| `/gallery` | 照片画廊（CDN 图片框架，支持相册/标签筛选 + lightbox） |
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

## 附件与下载

附件保存在仓库根目录 `attachments/`，支持按文章、主题或数据集建立多级目录。`web/` 保存发布和编辑功能，`web/public/` 用于框架资源。文件名、类型和大小自动读取，无需维护附件清单。

```text
attachments/
└── runtime-study/
    ├── samples.csv
    ├── report.pdf
    └── sources/
        └── algorithm.rs
```

正文使用与 sticker 相同的紧凑 DSL。行内附件显示为带文件元数据的下载胶囊，块级附件显示为可视化预览面板：

```markdown
:attachment[runtime-study/samples.csv]:

::attachment[runtime-study/report.pdf]::
```

`::attachment[...]::` 必须独占顶层段落；列表、引用、标题或混合段落中的块级标记保持为普通文本。附件语法不接受自定义标签，显示名固定取自真实文件名，并附带类型与大小。旧的 `[标签](attachment:...)` 写法会在开发和构建时报告迁移错误。

开发和构建都会将引用解析为 `/downloads/runtime-study/samples.csv`。构建产物位于 `web/dist/downloads/`，由 Astro integration 自动生成，直接执行 `astro build` 同样有效。配置了 Astro `base` 时，下载地址自动加上该前缀。

块级面板保持有限高度，顶部提供下载与全屏查看。图片、文本与代码、JSON、CSV/TSV、PDF、音频和视频按类型呈现；其他二进制文件显示文件元数据与下载入口。PDF 进入可视区域后才加载，通过隔离的 worker 逐页解析并绘制到 canvas，上一页和下一页共用一张有界画布；超过 32 MiB 时仅保留下载入口。标准字体和 CMap 以带 PDF.js 版本号的站内路径按需读取，可显示未嵌入 Base-14 字体及使用预定义 CMap 的文档；这些运行时资源不进入 PWA 预缓存。HTML、JavaScript 和 MDX 附件只显示源代码，不在页面中执行。文本预览最多读取 64 KiB 和 400 行，表格最多显示 80 行、24 列，单元格最多显示 4 KiB；达到限制时面板会提示下载完整文件。微信导出等可移植输出将块级面板转换为普通的绝对下载链接。

在线编辑器提供两个附件入口，界面使用现有的新拟态主题与自定义下拉框：

- 文件面板中的“全局附件”：管理根 `attachments/` 下的全部文件，可搜索、按分组筛选，也可向根目录或指定分组上传。
- 文章编辑器顶部工具栏中的“📎 当前文章附件”：只管理 `attachments/<文章 slug>/` 及其子目录。上传目录留空时，文件直接放入该文章的附件目录。

两个入口均支持上传、重命名、替换内容、删除、下载、复制引用，以及插入行内胶囊或块级预览。上传重名文件会自动编号；重命名不覆盖同名文件；替换内容需要确认，保留原文件标识和下载地址，完整写入后才切换为新内容。单个附件可供多篇文章引用。

重命名和删除前会检查磁盘中的文章、想法及附件 Markdown 链接。存在引用时，面板显示引用位置，需先修改引用；也可使用“替换内容”保留原链接。此检查不识别动态生成的链接。文章重命名不会自动更改附件目录，原附件仍可从全局入口管理。

附件与文章应一并纳入版本管理。当前编辑器中的文章提交仅覆盖 `posts/`，`attachments/` 通过仓库的常规提交流程管理。

文件名支持中文、空格和括号，编辑器生成的引用会自动编码。手写 DSL 时，按 URL 路径段编码特殊字符，例如 `结果 (1).csv` 写成 `结果%20%281%29.csv`。正文图片仍可使用现有图片语法；需要附件元数据、下载和全屏预览时使用 Attachment DSL。

`bun run quality` 和构建会检查文章及想法正文中的附件引用，文件缺失或路径无效时报告来源位置。正文渲染、引用扫描、搜索、阅读时长、文章预览和微信导出共用解析规则；非渲染文本输出只保留附件文件名，不暴露 DSL 标记。微信导出使用配置的正式站点绝对地址。

编辑器单文件上传上限为 32 MiB；直接放入根目录的文件不受此上传上限限制。隐藏文件不发布，符号链接及非普通文件会被拒绝，下载目录不加入 PWA 预缓存。所有合法附件都会发布，包括尚未被正文引用的文件。

Astro 内置 `preview` 会将 `.gz`、`.br` 后缀标记为传输压缩，下载这两种文件时可能发生浏览器自动解码；源文件与构建复制保持原字节。需要核对压缩包下载时，应检查实际托管响应；ZIP 不受这个后缀行为影响。

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

## 照片画廊 & CDN 图片框架

画廊页面 `/gallery` 展示 CDN 托管的照片，支持相册/标签筛选和 lightbox 浏览。

图片元数据放在 `gallery/` 目录的 YAML 文件中（每个文件一个相册）：

```yaml
# gallery/tokyo-2024.yaml
sakura-park:
  alt: "Cherry blossoms in Ueno Park"
  width: 4032
  height: 3024
  format: jpg
  variants:
    - { name: thumb, width: 400, height: 300 }
    - { name: medium, width: 1200, height: 900 }
  album: tokyo-2024
  tags: [sakura, spring]
  source: cdn          # 或 local（开发时用本地文件）
```

CDN 配置通过环境变量切换，不改代码：

```bash
# .env — 配置后自动使用 R2，不配则用本地文件
CDN_ENDPOINT=https://cdn.benign.host
CDN_BUCKET=your-bucket
```

框架支持任意 CDN 提供商——实现 `CdnAdapter` 接口即可切换。

---

## 在线编辑器

```bash
bun run dev:editor
```

功能：文章 CRUD、实时预览、图片资源与附件管理、格式化工具栏、AI 辅助（润色/翻译/续写）、Git 提交、微信公众号导出。想法页面在编辑器模式下也内置了想法编辑器，支持创建/编辑/删除想法、AI 标签建议、心情选择、贴纸插入、实时预览和草稿持久化。

AI 功能需在 `web/.env` 配置 OpenAI 兼容 API，未配置时自动隐藏。

---

## 质量检查

```bash
bun run quality
```

包含 10 项检查：Token 完整性、Token 使用、WCAG 对比度、Aria 标签、CSS 质量、内容校验、Import 规范、硬编码字符串、移动端响应式、Bundle 大小。

---

## 项目结构

```
├── gallery/                   # 照片画廊（.yaml 图片注册表）
├── posts/                     # 文章（.mdx）
├── thoughts/                  # 想法（.yaml）
├── friends/                   # 友链（.yaml）
├── wishes/                    # 心愿（.yaml）
├── assets/                    # 全局静态资源（图片、贴纸）
├── attachments/               # 附件源文件（多级目录，自动生成下载地址）
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
│       │   ├── shared/        # FormattedDate, Giscus, ShareCard, FriendCard, RemoteImage...
│       │   ├── gallery/       # GalleryLightbox
│       │   └── editor/
│       │       ├── shared/    # editor-tokens, StickerPanel
│       │       ├── thought/   # Editor, Preview, use-api, use-draft
│       │       └── post/      # Live, Mdx, Toolbar, PostList, panels/
│       ├── lib/
│       │   ├── attachments/   # 路径解析、元信息、上传、校验与静态发布
│       │   ├── blog/          # archive, series, tags, hero, related, filter
│       │   ├── cdn/           # adapter, r2-adapter, local-adapter, cdn-config, url-resolver
│       │   ├── search/        # engine, highlight
│       │   ├── markdown/      # rehype/remark plugins
│       │   └── editor/        # formatting, shortcuts, utils, routes/
│       ├── data/              # thoughts, friends, wishes, gallery, schemas, yaml-loader
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
| 图片托管 | CDN 抽象层（Cloudflare R2 / 本地适配器） |
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
