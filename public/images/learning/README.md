# 学习笔记封面照片

## Hero 建筑插图

两组建筑均以用户提供的建筑素描为基础做透明裁切、灰度整理和边缘优化。线稿、图像与页面装饰不依赖外部字体。

| 文件组 | 设计坐标 | 内容 |
| --- | --- | --- |
| `hero-campus-outline.svg`、`hero-campus-sketch.webp` | 1440 × 800，横向 | 混凝土墙、深挑檐、玻璃幕墙与前庭台阶的正立面 |
| `hero-tower-outline.svg`、`hero-tower-sketch.webp` | 1000 × 1200，竖向 | 高层建筑的竖向肋板、基座门廊与台阶广场 |

每组线稿与完整素描使用相同的几何坐标。初始 SVG 仅包含可见的建筑结构线，透明背景、无颜色填充；完整图保留或绘制玻璃反射、排线、石墨颗粒及投影，以 WebP 加载。
透明画布衔接页面背景。坐标选框、红日与景观树均由页面独立合成；上方树木随完整素描一起展开，下方树木在滚动显影后段出现。

上方开屏使用 `src/components/LearningCoverOutline.tsx` 中的内联 SVG 分笔绘制，`hero-campus-outline.svg` 保留为静态结构参考。两张 WebP 就绪后，从基线、台阶依次画出左侧柱墙、中央窗梁、右侧基座，橙色百分比线同步推进。约 5.1 秒完成描线与进度，5.76 秒开始用 0.72 秒向上下展开建筑和树木；6.95 秒起边缘刻度与辅助线淡入。完整素描始终保持显影时的 90% 比例，不再进行结尾放大。减少动态模式以相同比例直接呈现完整画面，不等待动画时序。

后期处理保留石墨颗粒和原有阴影，清理截图游标、纸色及边框；适度锐化并提高输出采样尺寸，不声称恢复原图中不存在的细节。
网页仅加载轻量线稿 SVG 与预渲染的 WebP，不实时渲染复杂材质滤镜。`hero-ink-edge-atlas.png` 将 32 个相关的侵蚀形态及重复首帧存入窄幅图集；滚动进度决定边缘形态，停滚时保持静止，上滚回到同一位置时恢复同一形态。上部实心遮罩与窄带窗口共同限制图集，避免相邻帧透出；两个方向相反的变换在边缘推进时保持建筑位置稳定。`hero-ink-edge.png` 保留为静态兼容遮罩，减少动态模式直接显示完整建筑。

### 景观树素材

`hero-campus-trees.webp` 与 `hero-tower-trees.webp` 直接提取自对应参考图，使用与建筑完全一致的画布和位置。上方保留裸枝树与浅灰后影，与主体共用开屏裁切窗口；下方保留原有阔叶树、景观带和树池，使树根自然落在种植位置，并在滚动显影后段淡入。

## 笔记封面

2026-10-12 通过网络搜索与 Unsplash 站内搜索选取的相关摄影作品，采用 [Unsplash License](https://unsplash.com/license)，允许下载、修改及商业或非商业使用。以下均为免费照片，不使用 Unsplash+ 素材。

网页从本目录读取本地 WebP，不依赖远程图片服务。每张为 960 × 1280，经过裁切与压缩；不同笔记可以共享同主题的照片并调整构图。摄影来源记录于本文档与封面配置。

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
