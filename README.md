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

基于 React、TypeScript、Tailwind CSS 和 Vite 的静态多页面网站，包含首页、About、Learning、Projects、项目介绍、Studio 和 Contact。内容集中在 `src/data`，页面入口和元信息由 `src/lib/routes.ts` 与 `vite.config.ts` 管理。

## 开发与验证

使用与部署流程一致的 Node.js 24，在项目根目录执行：

```powershell
npm ci
npm run dev
```

| 命令 | 用途 |
| --- | --- |
| `npm run build` | TypeScript 检查和生产构建，输出到 `dist`。 |
| `npm run preview` | 预览生产构建。 |
| `npm run lint` | ESLint 检查。 |
| `npm run test:snapshots` | GitHub 快照、离线兜底及部署历史保留规则。 |
| `npm run test:project-docs` | 手动资料同步、隐私清理和路由检查。 |
| `npm run test:project-visuals` | 项目配图与元数据检查。 |
| `npm run test:home-now` | 首页阅读窗口、滚动锁、焦点归还和花纹动效。 |
| `npm run test:project-details` | 项目章节、图集和返回状态。 |
| `npm run test:gallery` | 通用图片浏览器。 |

完整命令见 `package.json`。浏览器检查需要 Playwright 和浏览器，默认使用 Microsoft Edge；按对应测试启动开发服务或生产预览。可通过 `PROJECTS_TEST_URL`、`PROJECTS_BROWSER_CHANNEL`、`PROJECTS_BROWSER_EXECUTABLE` 指定测试入口与浏览器。

## 内容维护

| 文件 | 用途 |
| --- | --- |
| `src/data/profile.ts` | 个人简介、学习背景和当前方向。 |
| `src/data/home-editorial.ts` | 首页目录与近况封面。 |
| `src/data/skills.ts`、`src/data/notes.ts` | 学习分类、笔记和参考资料。 |
| `src/data/note-covers.ts` | 笔记封面及摄影来源。 |
| `src/data/projects.ts` | 项目分类、简介、配图和链接。 |
| `src/data/project-introductions.ts` | 站内项目介绍、章节和实验配图。 |
| `src/data/timeline.ts` | 阶段计划。 |
| `src/data/contact.ts` | 联系方式。 |

项目 ID 同时用于介绍页地址和索引。Vite 根据项目数据生成各详情页的 HTML 入口；项目介绍随代码维护，不依赖远端 README。修改实验数字或配图时，应同步核对对应报告与素材来源。

增加页面时，在 `src/pages` 创建组件并接入 `src/App.tsx`，更新 `src/lib/routes.ts`，添加静态 HTML 入口及 `vite.config.ts` 中的构建入口。

图片与字体使用 `public` 内的正式素材。各素材目录的 README 和许可证保留来源、授权及维护说明；字体子集变更见 [字体说明](public/fonts/README.md)。图片浏览模块的接口见 [Image gallery](src/components/image-gallery/README.md)。

保留的手动维护工具：

- `npm run posters:render`：重建项目海报。
- `node --use-env-proxy scripts/sync-learning-covers.mjs`：更新学习笔记封面。
- `node --use-env-proxy scripts/sync-navigation-photos.mjs`：更新导航照片。
- `npm run sync:projects`：同步仓库资料供人工核对，不参与自动构建。

## 动态数据与部署

开发和构建前会同步项目转场模板、GitHub 动态与 RSS。站内搜索使用本地内容索引；浏览器读取同源 JSON 快照，不直接调用 GitHub 或 RSS 服务。

- `public/data/github.json` 最多保留 3 个项目，`public/data/rss.json` 最多保留 12 条内容；生成文件被 Git 忽略。
- GitHub 同步失败时使用最新有效快照，并保留原同步时间；没有可用快照时停止构建。RSS 同步失败时保留上次成功数据。
- 本地可通过进程环境变量 `GH_TOKEN` 或 `GITHUB_TOKEN` 认证；Actions 使用内置令牌。令牌不写入前端文件。站点地址由 `SITE_URL` 指定。
- 推送到 `main`、手动触发或每 6 小时的定时任务都会运行部署工作流；北京时间为 08:17、14:17、20:17 和次日 02:17。
- Actions 先检查快照及文档同步，再构建并发布 `dist`；构建产物保留 1 天。
- 历史清理保护最近 20 次、最近 7 天、当前或进行中的运行，以及最近一次成功运行；每次最多删除 100 条过期记录。部署成功后仅保留最新的 Pages deployment。

工作流位于 `.github/workflows/deploy.yml`，保留规则位于 `scripts/cleanup-history.mjs`。本地字体源文件与 Live2D 资料保存在被 Git 忽略的 `downloads`，不参与部署。
