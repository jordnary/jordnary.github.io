# Jordnary Personal Website

Jordnary 的个人网站，用于整理个人叙事、计算机与 AI 学习笔记、项目案例、阶段计划和联系方式。

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC?style=flat)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat)](https://vite.dev/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-auto%20deploy-222222?style=flat)](https://pages.github.com/)

## 在线访问

- Website: [jordnary.github.io](https://jordnary.github.io)
- GitHub: [github.com/jordnary](https://github.com/jordnary)

## 项目概览

这是一个基于 React、TypeScript、Tailwind CSS 和 Vite 构建的静态个人网站。当前内容围绕“计算机基础、人工智能学习、Web 项目实践、持续记录”展开，并使用 Vite 多页面构建生成可直接访问的独立页面：

- `/`：首页，展示个人定位、各内容页面入口，以及 GitHub 与 RSS 动态。
- `/about/`：以个人叙事说明学习背景、当前方向、选择 CS / AI / Web 的原因与长期问题。
- `/learning/`：按知识分类组织学习方向，沉淀带有“问题—理解—实践—参考”结构的笔记，并记录阶段计划。
- `/projects/`：按 Web 应用、机器学习和视觉实验展示 8 个公开项目，结合项目海报、实验图、原理示意与简洁的项目摘要。
- `/projects/<project-id>/`：独立项目介绍页，说明项目用途、主要实现与实际效果，提供章节目录和可放大的实验图片，支持直接访问和刷新。
- `/contact/`：提供邮箱、GitHub 和网站入口。

项目采用数据驱动的内容结构。个人简介、技能、项目、时间线和联系方式集中维护在 `src/data`；跨页导航与页面元信息集中维护在 `src/lib/routes.ts`；每个页面组合在 `src/pages`。这让新增专题时不必再把所有内容堆到首页。

## 技术栈

- React 19：构建页面组件与交互界面。
- TypeScript 6：约束内容数据、组件 props 和项目类型。
- Tailwind CSS 4：管理响应式布局、视觉样式和主题细节。
- Vite 8：提供本地开发服务器、生产构建和预览流程。
- Motion：处理页面进入、滚动和交互动效。
- ESLint：执行基础代码质量检查。
- GitHub Actions + GitHub Pages：自动构建并部署静态站点。

## 快速开始

请先安装 Node.js LTS，然后在项目根目录执行：

```powershell
npm ci
npm run dev
```

开发服务器启动后，根据终端提示打开本地地址，通常是：

```text
http://localhost:5173
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 本地开发服务器。 |
| `npm run lint` | 运行 ESLint 检查。 |
| `npm run build` | 执行 TypeScript 构建检查并生成生产产物。 |
| `npm run sync:feeds` | 拉取 RSS 源并生成供页面读取的静态数据。 |
| `npm run sync:github` | 同步 GitHub 公开数据，失败时恢复上一份有效快照。 |
| `npm run sync:projects` | 手动同步仓库文档与图片，供资料核对；站内介绍不依赖此命令。 |
| `npm run test:snapshots` | 验证快照同步、离线兜底及历史清理规则。 |
| `npm run test:projects` | 在本地服务启动后，检查项目入口、筛选、图片预览、键盘操作、站内搜索和响应式布局。 |
| `npm run test:project-docs` | 验证文档同步、图片路径、失败回退、隐私清理与详情页路由。 |
| `npm run test:project-details` | 对生产预览检查八篇介绍、章节链接、图片缩放、返回恢复和无远端文档依赖的阅读。 |
| `npm run preview` | 本地预览 `dist` 生产构建结果。 |

## 站内搜索与动态内容

- 在任意页面点击导航栏“搜索”，或按 `Ctrl/⌘ + K`，即可搜索项目、学习方向、时间线与站内页面。搜索索引来自 `src/data`，完全在浏览器本地运行，不依赖第三方搜索服务。
- 首页 Code Activity 读取同源的 `data/github.json`，访客浏览器不再请求 GitHub API。`scripts/sync-github.mjs` 在 `dev` 与 `build` 前同步公开资料和最近维护的 3 个非 fork、未归档公开仓库；生成文件被 Git 忽略，不会产生数据提交历史。
- Actions 使用内置 `github.token` 认证同步，无需额外配置个人令牌。令牌仅用于构建阶段的 GitHub API 请求，不会写入 JSON、前端代码或发往快照站点。本地可通过进程环境变量 `GH_TOKEN` 或 `GITHUB_TOKEN` 提供认证；未设置时使用匿名请求。
- GitHub 同步失败时，从本地文件与已发布站点中选取最新的有效快照，并保留原 `fetchedAt`。Actions 通过 Pages 的 `base_url` 设置 `SITE_URL`，支持自定义域名和站点子路径。首次构建若无法同步且没有旧快照，会停止部署，避免空数据覆盖线上网站。
- 浏览器刷新只重新读取站内快照，不触发 GitHub 同步；刷新时保留现有内容，加载失败时使用本地缓存并提示旧数据，页面显示真实同步时间。需要立即同步时，手动运行部署工作流。
- RSS 阅读流由 `scripts/sync-rss.mjs` 在 `dev` 与 `build` 前自动同步；生成的 `public/data/rss.json` 会被忽略，不会提交到仓库。这样 GitHub Pages 的访客始终读取同源静态 JSON，不受浏览器跨域限制。
- 默认 RSS 源为 GitHub Blog 与 Hacker News。可在 `scripts/sync-rss.mjs` 的 `feedSources` 中增删来源；脚本会在单个来源失败时继续生成其余内容，并在所有来源暂时不可用时保留上一份成功数据。

## 内容维护

大部分页面内容可以通过修改 `src/data` 下的数据文件完成：

| 文件 | 用途 |
| --- | --- |
| `src/data/profile.ts` | 维护个人叙事、学习背景、当前方向与长期问题。 |
| `src/data/skills.ts` | 维护知识分类及每类正在沉淀的主题。 |
| `src/data/notes.ts` | 维护可筛选的学习笔记、实践说明与参考来源。 |
| `src/data/projects.ts` | 维护项目分类、简介、技术栈、图片与站内外入口。 |
| `src/data/project-introductions.ts` | 为每个项目维护独立介绍的章节、段落与实验配图。 |
| `src/data/timeline.ts` | 维护面向下一步的阶段计划。 |
| `src/data/contact.ts` | 维护邮箱、GitHub、网站链接和联系说明。 |

Projects 的项目 ID 同时用于列表锚点与独立介绍页地址；站内搜索直接打开相应项目介绍。项目图保存在 `public/images/projects`，采用 WebP 与延迟加载。两个网站使用包含各自网站元素的本地合成海报，实验项目以完整结果图制作封面；`image.cover` 可单独配置封面，图库仍展示 `image.file` 中的原图。原生对话框支持方向键、Escape 关闭和焦点恢复。卡片复用全站 Motion 入场动画，并尊重减少动态效果的系统设置。原理示意单独标注，不能代替实验结果。素材来源与处理方式见该目录的 `README.md`；更新内容时应同时核对来源、可访问状态和图片。运行 `npm run posters:render` 可在本地重建五张海报，无需 API。

项目浏览器检查沿用现有 Playwright 运行方式，默认使用 Microsoft Edge 和 `http://127.0.0.1:5173/`，可通过 `PROJECTS_TEST_URL`、`PROJECTS_BROWSER_CHANNEL` 或 `PROJECTS_BROWSER_EXECUTABLE` 覆盖。先运行 `npm run dev`，再执行 `npm run test:projects`。

项目标题与卡片左侧的“项目介绍”打开站内详情页，右侧“访问网站”或“查看仓库”在新标签页打开外部链接。介绍内容保存在 `src/data/project-introductions.ts`，随详情组件一起按需加载；每篇围绕用途、实现和效果单独撰写，不直接展示仓库 README。实验数字依据对应公开报告，适用范围写在相关结果段落中。

详情页提供桌面侧边目录和手机折叠目录。封面与正文实验图共用原生弹窗，支持 100%–300% 缩放、滚动查看和关闭后的焦点恢复。返回入口与浏览器后退保留项目列表的筛选和滚动位置。

`scripts/sync-project-docs.mjs` 保留为手动资料同步工具，可读取项目的 `source.href` 并缓存 Markdown 与图片，供核对技术资料使用。它不再参与开发或生产构建的自动流程，远端 README 的更新不会覆盖本站介绍。

Vite 从项目数据自动生成各详情页的 HTML 入口和独立元信息，无需手动创建八份页面文件，也无需配置服务器路由回退。详情页浏览器检查默认连接 `http://127.0.0.1:4173/`，先构建并运行 `npm run preview`，再执行 `npm run test:project-details`。

页面路由、导航标签和客户端标题集中维护在 `src/lib/routes.ts`。要增加一个新页面：

1. 在 `src/pages` 新增页面组件，并在 `src/App.tsx` 中注册它。
2. 在 `src/lib/routes.ts` 的 `sitePages` 与 `siteRoutes` 中添加页面标识和元信息。
3. 新增对应的 `<页面名>/index.html`，并在 `vite.config.ts` 的 `rollupOptions.input` 中加入入口。

这样生成的页面会保留目录形式的 URL，例如 `/notes/`，可被 GitHub Pages 直接服务，无需依赖单页应用的路由回退。

如果需要调整页面布局、交互或视觉样式，主要关注：

- `src/components`：页面区块、导航、项目卡片、时间线、Toast 等组件。
- `src/lib/animations.ts`：动效相关配置。
- `src/lib/theme.ts`：主题辅助逻辑。
- `src/index.css`：全局样式、Tailwind 样式入口和视觉细节。

## 构建与部署

本地构建：

```powershell
npm run build
```

构建产物会输出到 `dist` 目录，且该目录已在 `.gitignore` 中忽略。可通过以下命令预览生产构建结果：

```powershell
npm run preview
```

GitHub Pages 部署流程配置在 `.github/workflows/deploy.yml` 中：

- `main` 分支收到 push 后自动触发部署。
- 每 6 小时自动同步 GitHub / RSS 数据并部署一次（UTC 的 00:17、06:17、12:17、18:17；北京时间 08:17、14:17、20:17、次日 02:17）。定时任务可能因 Actions 排队而延迟。
- 工作流使用 Node.js LTS 并通过 `npm ci` 安装依赖。
- 执行 `npm run build` 生成 `dist` 静态产物。
- 上传 Pages artifact 并部署到 GitHub Pages。
- 也可以在 GitHub Actions 页面手动运行 `Deploy static content to Pages`。

### 数据与历史保留

- GitHub 快照固定覆盖 `public/data/github.json`，最多保留 3 个项目；RSS 快照最多保留 12 条内容。不创建按时间命名的快照文件，不将生成数据提交到 Git。
- Pages 构建 artifact 设置 `retention-days: 1`，一天后自动过期；线上快照由 Pages 提供，不依赖短期 artifact 保存。
- 每次工作流结束后清理该部署工作流的历史：保护最近 20 次、最近 7 天、当前运行、进行中的运行和最近一次成功运行；仅删除同时超出数量和时间门槛的已完成记录，每次最多 100 条。其他工作流不受影响。规则位于 `scripts/cleanup-history.mjs`。
- 继续沿用部署记录清理：新部署成功后，只保留最新一条 `github-pages` deployment 记录。构建失败时仍可清理旧工作流记录，但不会执行部署记录清理。
- 清理任务单独使用 `actions: write` 和 `deployments: write`；构建任务只保留读取代码与发布 Pages 所需权限。

参考：[Pages artifact 保留参数](https://github.com/actions/upload-pages-artifact#inputs-)、[工作流记录删除 API](https://docs.github.com/en/rest/actions/workflow-runs#delete-a-workflow-run)。

## 目录结构

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages 自动部署工作流
├── public/
│   ├── images/                 # 页面背景图与响应式图片资源
│   ├── favicon.svg             # 网站图标
│   ├── og-image.png            # Open Graph 分享图
│   └── site.webmanifest        # PWA / 站点 manifest
├── src/
│   ├── components/             # 页面区块、导航、项目卡片、时间线等 React 组件
│   ├── data/                   # 个人简介、技能、项目、时间线、联系方式等内容数据
│   ├── layouts/                # 全站共享布局
│   ├── lib/                    # 动效、主题与跨页路由配置
│   ├── pages/                  # 首页及各独立页面的组合入口
│   ├── App.tsx                 # 根据页面入口渲染对应内容
│   ├── index.css               # 全局样式与 Tailwind 样式入口
│   └── main.tsx                # React 挂载入口
├── about/                      # /about/ 的静态 HTML 入口
├── contact/                    # /contact/ 的静态 HTML 入口
├── learning/                   # /learning/ 的静态 HTML 入口
├── projects/                   # /projects/ 的静态 HTML 入口
├── index.html                  # Vite HTML 入口与站点 meta 信息
├── package.json                # 项目脚本与依赖声明
├── tsconfig*.json              # TypeScript 配置
├── vite.config.ts              # Vite、React、Tailwind 插件配置
└── README.md                   # 项目说明文档
```

## 后续计划

- 持续补充项目案例，完善项目详情、预览图和外部链接。
- 扩展学习笔记入口，让数据库、机器学习、大模型等内容更容易长期沉淀。
- 优化移动端细节，包括首屏节奏、触控状态和小屏阅读体验。
- 增强可访问性检查，例如焦点状态、语义结构和颜色对比度。
- 梳理内容维护规范，让 `src/data` 中的个人资料、技能和时间线更容易更新。
