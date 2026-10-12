# 学习笔记封面照片

2026-10-12 通过网络搜索与 Unsplash 站内搜索选取的相关摄影作品，采用 [Unsplash License](https://unsplash.com/license)，允许下载、修改及商业或非商业使用。以下均为免费照片，不使用 Unsplash+ 素材。

网页从本目录读取本地 WebP，不依赖远程图片服务。每张为 960 × 1280，经过裁切与压缩；不同笔记可以共享同主题的照片并调整构图。摄影来源也在笔记阅读页显示。

| 本地文件 | 内容 | 摄影师 | 原始作品 |
| --- | --- | --- | --- |
| `servers.webp` | 服务器机架 | Kevin Ache | [Unsplash](https://unsplash.com/photos/2JJ3wBHu4_0) |
| `network.webp` | 网络线缆 | Taylor Vick | [Unsplash](https://unsplash.com/photos/M5tzZtFCOfs) |
| `circuits.webp` | 电路板元件 | Alexandre Debiève | [Unsplash](https://unsplash.com/photos/FO7JIlwjOtU) |
| `blue-chip.webp` | 蓝色电路板 | Umberto | [Unsplash](https://unsplash.com/photos/jXd2FSvcRr8) |
| `motherboard.webp` | 主板集成电路 | Vishnu Mohanan | [Unsplash](https://unsplash.com/photos/pfR18JNEMv8) |
| `cables.webp` | 服务器接口 | Lightsaber Collection | [Unsplash](https://unsplash.com/photos/T-IN5o3kxyA) |
| `coding.webp` | 代码屏幕 | Mohammad Rahmani | [Unsplash](https://unsplash.com/photos/8qEB0fTe9Vw) |
| `workspace.webp` | 编程工作台 | Safar Safarov | [Unsplash](https://unsplash.com/photos/koOdUvfGr4c) |
| `notebook.webp` | 笔记本与笔 | Justin Morgan | [Unsplash](https://unsplash.com/photos/Hx-4TbpsoIw) |
| `study-desk.webp` | 学习桌面 | Fiona Murray-deGraaff | [Unsplash](https://unsplash.com/photos/91fyuCdgtsM) |

封面配置与来源位于 `src/data/note-covers.ts`。需重新下载时，在项目根目录运行 `node --use-env-proxy scripts/sync-learning-covers.mjs`。该命令是手动维护工具，不参与自动构建。

动态效果通过 CSS 缩放和平移本地照片实现，仅在当前封面、悬停或键盘聚焦时播放。系统开启 `prefers-reduced-motion` 时保留静态照片。
