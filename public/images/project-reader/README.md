# 项目详情页线稿

当前仅使用 `wing-lineart.webp`，用于具体项目详情页的章节阅读区。
左右两侧使用同一张羽翼与飘带线稿，右侧水平镜像，保持装饰统一。

参照 About 页边饰的处理，羽翼固定为 `17rem` 宽，与文字保持稳定比例。
窗口变小时裁切外缘与上下边缘，并在裁切处渐隐；可用边距或高度不足时
左右同步隐藏。装饰锚定整个阅读框外侧，正文、章节标签与导航保持净空。

旧成品 `character-lineart.webp` 保留备用，页面不显示。
`corner-lineart.webp` 保存在被 Git 忽略的 `downloads/project-reader/`，不部署。

处理时以亮度反相结合原始透明度提取线条，去除白色填充和亮部纸纹。
羽翼裁去外围透明空间，并保留少量边距，最大宽度 512 像素；
不放大源图，保留抗锯齿，输出无源元数据的无损 WebP。
成品只有纯黑线条和透明背景，整体灰度、浅淡程度及渐隐由页面 CSS 控制。

原始 PNG 保存在被 Git 忽略的 `downloads/project-reader/`：
`character-lineart.png`、`wing-lineart.png`、`corner-lineart.png`。

在项目根目录安装 Pillow 后，可重建当前使用的羽翼成品：

```sh
python scripts/prepare-project-reader.py
```
