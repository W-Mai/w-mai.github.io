# 个人博客 · 使用指南

基于 [Astro](https://astro.build) 构建的静态个人博客，集成 GitHub 项目展示、MDX 文章、Mermaid 图表、内置在线编辑器等功能。

---

## 快速开始

**依赖要求：** [Bun](https://bun.sh) >= 1.0.0（本项目只支持 bun，不支持 npm/yarn/pnpm）

```bash
# 安装依赖
cd web
bun install

# 启动开发服务器
bun run dev

# 启动开发服务器（带在线编辑器，导航栏会出现 ✏️ 编辑器入口）
bun run dev:editor

# 构建生产版本
bun run build

# 预览构建结果
bun run preview
```

---

## 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 首页，展示 GitHub 个人资料、置顶项目卡片、最新开源项目列表 |
| `/blog` | 博客文章列表 |
| `/blog/[slug]` | 文章详情页 |
| `/about` | 关于页面，展示个人信息和 GitHub 活动日历 |
| `/projects` | 项目页面，展示所有 GitHub 仓库 |
| `/gamev1.8` | 猜数字小游戏 |
| `/rss.xml` | RSS 订阅 |
| `/admin/live-editor` | 在线编辑器（仅 `dev:editor` 模式可见） |

导航栏中「瞅瞅」下拉菜单包含小游戏和 RSS 入口。

---

## 在线编辑器

项目内置了一个浏览器端的 MDX 在线编辑器，仅在开发模式下可用。通过 Astro 的 `injectRoute` 在 dev 模式动态注入路由，不会影响生产构建。

### 启动方式

```bash
bun run dev:editor
```

启动后导航栏会出现「✏️ 编辑器」链接，点击进入 `/admin/live-editor`。

### 编辑器功能

- **文章管理**：创建、编辑、删除文章，侧边栏支持文件名/文章标题切换显示，搜索过滤
- **实时预览**：左侧 CodeMirror 编辑 MDX，右侧 iframe 实时预览渲染效果，滚动同步
- **资源管理**：侧边栏 Assets 标签页，上传/删除图片资源，查看引用计数，点击缩略图放大预览
- **智能创建**：输入标题自动生成 slug（中文通过 pinyin-pro 转拼音），可选 AI 生成 slug
- **资源命名**：上传图片时弹出命名对话框，自动规范化文件名，支持 AI 建议
- **Git 提交**：顶栏 Commit 按钮，批量提交待提交文章，每篇可编辑 commit message，支持 AI 生成提交说明
- **格式化工具栏**：加粗、斜体、标题、链接、图片、代码块等快捷操作
- **右键菜单**：剪切/复制/粘贴、插入元素、AI 文本操作（润色/翻译/续写/精简）
- **AI Diff 面板**：选中文本后通过右键菜单触发 AI 操作，流式显示建议文本，可接受或拒绝
- **快捷键**：`Cmd+S` 保存，`Cmd+B` 加粗，`Cmd+I` 斜体，`Cmd+/` 快捷键面板等
- **自动保存**：编辑后 2 秒自动保存
- **响应式**：窄屏自动折叠侧边栏

### 编辑器 API 路由（仅 dev 模式）

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/editor/posts` | GET | 文章列表（`?detail` 返回标题） |
| `/api/editor/posts/[slug]` | GET/POST/PUT/DELETE | 文章 CRUD |
| `/api/editor/posts/[slug]/rename` | POST | 文章重命名 |
| `/api/editor/assets` | GET | 资源列表 |
| `/api/editor/assets/[name]` | GET/POST/DELETE | 资源读取/上传/删除 |
| `/api/editor/ai` | POST | AI 操作（polish/translate/continue/condense/suggest-slugs/suggest-asset-name/suggest-commit-msg） |
| `/api/editor/git` | GET/POST | 待提交列表 / 执行提交 |

### AI 功能配置

编辑器的 AI 功能需要配置 OpenAI 兼容的 API：

```bash
# 在 web/.env 中配置
OPENAI_API_BASE=https://api.openai.com/v1    # API 地址
OPENAI_API_KEY=sk-xxx                         # API Key
OPENAI_MODEL=gpt-4o                           # 模型名称
```

未配置时 AI 按钮自动隐藏，不影响其他功能。

---

## 个人信息配置

编辑 `web/src/consts.ts`：

```ts
export const USER_NAME = 'your-github-username';
export const NICK_NAME = '你的昵称';
export const SITE_TITLE = '网站标题';
export const SITE_DESCRIPTION = '网站描述';

// 首页置顶展示的 GitHub 项目，格式：'owner/repo' 或 'repo'（默认用 USER_NAME）
export const PINNED_PROJECTS = [
    'your-repo-1',
    'your-repo-2',
];

// 社交链接（显示在导航栏右侧和首页/项目页侧边栏）
export const SOCIALS = [
    { name: 'GitHub', url: 'https://github.com/xxx', description: 'GitHub Homepage', icon: '/social/github.svg' },
];
```

---

## 写文章

文章放在根目录 `posts/` 下，支持 `.md` 和 `.mdx` 格式。图片等资源放在 `posts/assets/`。

**文章 frontmatter：**

```yaml
---
title: '文章标题'
description: '文章描述'
pubDate: 'Jan 1 2025'
updatedDate: 'Feb 1 2025'          # 可选，更新日期
heroImage: './assets/your-image.png'  # 可选封面图，相对于 posts/ 目录
---
```

### 题图 Fallback

如果文章没有设置 `heroImage`，系统会自动处理：

1. 从文章正文中提取第一张本地图片（`./assets/xxx`）作为题图
2. 如果文章中也没有图片，根据标题自动生成渐变色题图（带 emoji 和标题文字）

博客列表页和文章详情页均适用此逻辑，所有文章都会有题图展示。

### 在 MDX 中使用组件

Vite 别名：`~` → `web/src/`，`@posts` → `posts/`

#### MultitabPreview — 多标签代码预览

```mdx
import MultitabPreview from "~/components/MultitabPreview.astro"
import { Fragment } from "astro/jsx-runtime"

<MultitabPreview labels={{tab0: "Python", tab1: "JavaScript", preview: "输出"}}>
  <Fragment slot="tab0">
    ```python
    print("Hello!")
    ```
  </Fragment>
  <Fragment slot="tab1">
    ```javascript
    console.log("Hello!")
    ```
  </Fragment>
  <Fragment slot="preview">
    ```
    Hello!
    ```
  </Fragment>
</MultitabPreview>
```

支持 `tab0` ~ `tab10` 共 11 个标签，`preview` 槽位用于展示输出结果。
多个组件可通过 `syncKey` 属性同步切换标签。

#### Mermaid 图表

直接在代码块中使用 ` ```mermaid ` 语法，由 `astro-mermaid` 插件渲染。

#### 代码高亮

使用 `astro-expressive-code`（Starlight 内置），支持标题、行高亮、diff 标记等。

---

## GitHub 集成

### 首页和项目页

- 首页展示 GitHub 头像、bio、follower/following 数、置顶项目卡片、最新仓库列表
- 项目页 `/projects` 展示所有公开仓库，置顶项目以大卡片展示（自动拉取 banner/logo/badges）
- 没有 banner 图的项目会根据项目名自动生成渐变色封面
- 关于页 `/about` 展示 GitHub 活动日历（contribution graph）

### GitHub Token

项目数据从 GitHub API 实时拉取，结果缓存 30 分钟（文件缓存在 `web/.astro/github-cache.json`）。如需提高 API 限额：

```bash
# 在 web/.env 中添加
GITHUB_TOKEN=your_github_personal_access_token
```

### 远程图片域名

`astro.config.mjs` 已配置允许优化的远程图片域名：`github.com`、`raw.githubusercontent.com`、`avatars.githubusercontent.com`、`user-images.githubusercontent.com`、`opengraph.githubassets.com`。

---

## 部署

构建产物在 `web/dist/` 目录，可直接部署到任何静态托管平台。

**GitHub Pages（推荐）：** 项目已配置 `.github/workflows/astro.yml`，推送到 `main` 分支自动触发 Bun 构建 + GitHub Pages 部署。

部署前修改 `web/astro.config.mjs` 中的站点地址：

```js
export default defineConfig({
  site: 'https://your-domain.com',
});
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Astro 5 + React 19 |
| 样式 | Tailwind CSS 4 + PostCSS |
| 编辑器 | CodeMirror 6 |
| 内容 | MDX + Astro Content Collections (glob loader) |
| 代码高亮 | Expressive Code (Starlight) |
| 图表 | Mermaid (astro-mermaid) |
| 图片处理 | Sharp |
| 包管理 | Bun |
| 测试 | Vitest + fast-check |
| 部署 | GitHub Actions → GitHub Pages |

---

## 项目结构

```
├── .github/workflows/        # GitHub Actions 部署工作流
├── posts/                     # 文章（.md / .mdx）
│   └── assets/                # 文章图片资源
├── web/
│   ├── public/                # 静态资源（字体、社交图标）
│   └── src/
│       ├── components/        # Astro 通用组件
│       │   ├── BlogHeroFallback.astro   # 题图 fallback 渐变生成
│       │   ├── FeaturedProjectCard.astro # 置顶项目大卡片
│       │   ├── GitHubActivityCalendar.astro # GitHub 活动日历
│       │   ├── MultitabPreview.astro    # 多标签代码预览
│       │   └── editor/        # 在线编辑器 React 组件
│       ├── content.config.ts  # Content Collection schema
│       ├── consts.ts          # 站点配置常量
│       ├── layouts/           # 页面布局（BlogPost, WithSidebar）
│       ├── lib/               # 工具函数
│       │   ├── blog-hero.ts   # 题图 fallback 逻辑
│       │   ├── github.ts      # GitHub API 集成（带文件缓存）
│       │   ├── language-colors.ts # 编程语言颜色映射
│       │   ├── editor-*.ts    # 编辑器工具函数
│       │   └── editor-routes/ # 编辑器 API 路由（dev only）
│       ├── pages/             # 路由页面
│       ├── styles/            # 全局样式
│       └── types.ts           # TypeScript 类型定义
└── web/astro.config.mjs       # Astro 配置
```

---

## 测试

```bash
cd web
bunx --bun vitest run
```
