# Jordnary Personal Website

Jordnary 的个人网站，用于整理个人简介、计算机与 AI 学习记录、项目实践、学习时间线和联系方式。

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

- `/`：首页，展示个人定位和各内容页面的入口。
- `/about/`：说明当前学习阶段、关注主题和成长记录方式。
- `/learning/`：按 Computer Science、AI & Machine Learning、Web Development、Tools & Workflow 组织学习方向，并记录学习时间线。
- `/projects/`：展示个人网站、学习笔记系统、AI Learning Playground 等项目与计划。
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
| `npm run preview` | 本地预览 `dist` 生产构建结果。 |

## 内容维护

大部分页面内容可以通过修改 `src/data` 下的数据文件完成：

| 文件 | 用途 |
| --- | --- |
| `src/data/profile.ts` | 维护个人简介、关键词、当前关注方向和亮点说明。 |
| `src/data/skills.ts` | 维护技能分类、技能名称和熟悉度展示。 |
| `src/data/projects.ts` | 维护项目卡片、筛选分类、技术栈、链接和预览信息。 |
| `src/data/timeline.ts` | 维护学习时间线与阶段计划。 |
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
