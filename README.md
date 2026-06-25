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
- `/projects/`：复盘可访问的真实项目案例；学习笔记系统和 AI Learning Playground 明确归入计划中 / 实验中。
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
| `npm run preview` | 本地预览 `dist` 生产构建结果。 |

## 站内搜索与动态内容

- 在任意页面点击导航栏“搜索”，或按 `Ctrl/⌘ + K`，即可搜索项目、学习方向、时间线与站内页面。搜索索引来自 `src/data`，完全在浏览器本地运行，不依赖第三方搜索服务。
- 首页的 GitHub Pulse 使用 GitHub 公共 REST API 读取 `jordnary` 的公开仓库和资料，并在浏览器中缓存 5 分钟，降低接口请求频率。
- RSS 阅读流由 `scripts/sync-rss.mjs` 在 `dev` 与 `build` 前自动同步；生成的 `public/data/rss.json` 会被忽略，不会提交到仓库。这样 GitHub Pages 的访客始终读取同源静态 JSON，不受浏览器跨域限制。
- 默认 RSS 源为 GitHub Blog 与 Hacker News。可在 `scripts/sync-rss.mjs` 的 `feedSources` 中增删来源；脚本会在单个来源失败时继续生成其余内容，并在所有来源暂时不可用时保留上一份成功数据。

## 内容维护

大部分页面内容可以通过修改 `src/data` 下的数据文件完成：

| 文件 | 用途 |
| --- | --- |
| `src/data/profile.ts` | 维护个人叙事、学习背景、当前方向与长期问题。 |
| `src/data/skills.ts` | 维护知识分类及每类正在沉淀的主题。 |
| `src/data/notes.ts` | 维护可筛选的学习笔记、实践说明与参考来源。 |
| `src/data/projects.ts` | 维护真实项目案例及计划中 / 实验中的方向。 |
| `src/data/timeline.ts` | 维护面向下一步的阶段计划。 |
| `src/data/contact.ts` | 维护邮箱、GitHub、网站链接和联系说明。 |

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
- 工作流使用 Node.js LTS 并通过 `npm ci` 安装依赖。
- 执行 `npm run build` 生成 `dist` 静态产物。
- 上传 Pages artifact 并部署到 GitHub Pages。
- 也可以在 GitHub Actions 页面手动运行 `Deploy static content to Pages`。

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
