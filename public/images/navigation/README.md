# 导航面板摄影素材

2026-10-13 根据参考视频的分栏导航风格，通过网络搜索选取以下照片。
图片用于内容主题的视觉引导，不是项目运行截图或个人经历照片。

| 文件前缀 | 用途 | 来源 |
| --- | --- | --- |
| `alpine-lake` | 关于：探索旅程 | [Unsplash 自然摄影](https://unsplash.com/s/photos/natural)，图片编号 `photo-1546587348-d12660c30c50` |
| `coding-workspace` | 项目：Web 应用 | [Tai Bui / Unsplash](https://unsplash.com/photos/v6TyCyiImoc) |
| `blue-circuits` | 项目：机器学习 | [Umberto / Unsplash](https://unsplash.com/photos/jXd2FSvcRr8) |
| `forest-details` | 项目：视觉实验 | [Benjamin Chambon / Unsplash](https://unsplash.com/photos/WNHmSNPwGHg) |

每张包含 1920 × 1200 高清 WebP 和 640 × 400 轻量版本，通过 `srcSet` 根据显示尺寸和屏幕密度选择；布局预留固定比例，图片加载不改变面板高度。学习面板保持纯文字。

所有运行时图片均从本站读取。维护时运行 `node --use-env-proxy scripts/sync-navigation-photos.mjs`，下载地址记录于 `src/data/navigation-photos.ts`；脚本检查格式及实际像素尺寸，不参与构建。
