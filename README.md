# Jordnary Personal Website

Jordnary 的个人网站，用于展示个人简介、技能方向、项目作品、学习时间线和联系方式。

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC?style=flat)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-auto%20deploy-222222?style=flat)

## 项目简介

这是一个基于 React、TypeScript、Tailwind CSS 和 Vite 构建的静态个人主页。网站围绕“前端学习、视觉表达、稳定交付”组织内容，包含首页 Hero、关于我、技能栈、项目展示、时间线和联系方式等模块。

项目采用组件化与数据驱动的结构，页面内容主要维护在 `src/data` 中，展示逻辑集中在 `src/components` 中，便于后续持续补充作品、调整文案和迭代视觉效果。

## 技术栈

- React 19：构建页面组件与交互界面。
- TypeScript：约束内容数据、组件 props 和项目类型。
- Tailwind CSS 4：管理响应式布局、视觉样式和主题细节。
- Vite 8：提供本地开发服务器和生产构建流程。
- Motion：处理页面动效与交互反馈。
- ESLint：执行基础代码质量检查。
- GitHub Actions + GitHub Pages：自动构建并部署静态站点。

## 本地运行

请先安装 Node.js，然后在项目根目录执行：

```powershell
npm ci
npm run dev
```

开发服务器启动后，根据终端提示打开本地地址，通常是：

```text
http://localhost:5173
```

常用脚本：

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

## 构建部署

本地构建：

```powershell
npm run build
```

构建产物会输出到 `dist` 目录。可通过以下命令在本地预览生产构建结果：

```powershell
npm run preview
```

GitHub Pages 部署流程已经配置在 `.github/workflows/deploy.yml` 中：

- 当 `main` 分支收到 push 后，GitHub Actions 会自动触发部署流程。
- 工作流会执行 `npm ci` 安装依赖。
- 随后运行 `npm run build` 生成 `dist` 静态产物。
- 最后将 `dist` 作为 Pages artifact 上传，并部署到 GitHub Pages。

如需手动触发部署，也可以在 GitHub 仓库的 Actions 页面运行 `Deploy static content to Pages` 工作流。

## 目录结构

```text
.
├── .github/workflows/       # GitHub Pages 自动部署工作流
├── public/                  # favicon、manifest、Open Graph 图片等静态资源
├── src/
│   ├── assets/              # 页面使用的本地图片与资源
│   ├── components/          # 页面区块、导航、项目卡片、时间线等 React 组件
│   ├── data/                # 个人简介、技能、项目、时间线、联系方式等内容数据
│   ├── lib/                 # 动效与通用辅助逻辑
│   ├── App.tsx              # 页面组合入口
│   ├── index.css            # 全局样式与 Tailwind 样式入口
│   └── main.tsx             # React 挂载入口
├── index.html               # Vite HTML 入口
├── package.json             # 项目脚本与依赖声明
├── vite.config.ts           # Vite、React、Tailwind 插件配置
└── README.md                # 项目说明文档
```

## 后续计划

- 持续补充项目案例，完善项目详情、预览图和外部链接。
- 优化移动端细节，包括首屏节奏、触控状态和小屏阅读体验。
- 增强可访问性检查，例如焦点状态、语义结构和颜色对比度。
- 补充更完整的元信息与 SEO 配置，提升分享预览效果。
- 梳理内容维护规范，让 `src/data` 中的个人资料、技能和时间线更容易长期更新。
