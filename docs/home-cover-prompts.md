# 首页封面图片生成提示词

首页采用浅青柠绿 `#ddecba`、纸白 `#fbfcf7` 和墨绿黑 `#23352b`，配合衬线标题、轻盈气泡与大圆角照片。主视觉文案是 **LEARN. BUILD. BECOME.**，图片围绕学习、制作与日常观察展开。照片保留自然光、轻微胶片颗粒和编辑式日常摄影感，以纸白、浅木色、低饱和植物绿与少量深色细节呼应页面，避免整张照片泛绿。

**页面配色与文字由代码实现，不要在照片里添加纯青柠色背景、色块底板、圆角边框或主视觉文案。**

当前版本临时使用站内已有照片。封面映射集中在 `src/data/home-editorial.ts` 的 `homeEditorialCovers`，每项包含 `src` 和 `alt`。新图生成后，按下表导出为 WebP，放入 `public/images/home/`，再更新该映射即可。下列文件名是最终图片的约定名称。

| 页面位置 | 最终文件 | 建议原图尺寸 | 比例 |
| --- | --- | --- | --- |
| 精选项目主封面 · `featured` | `public/images/home/curious-desk.webp` | 1536 × 1024 | 3:2 |
| 学习卡片 · `learning` | `public/images/home/learning-notes.webp` | 1536 × 1152 | 4:3 |
| 实验卡片 · `experiments` | `public/images/home/small-experiments.webp` | 1536 × 1152 | 4:3 |
| 日常卡片 · `everyday` | `public/images/home/everyday-observations.webp` | 1536 × 1152 | 4:3 |

## 生成与裁剪要求

- 每条英文提示词可以直接单独复制使用。建议先生成主封面，再将其作为其他三张的风格参考，让光线、颗粒和色温保持一致。
- 如果工具不能直接输出建议尺寸，选择最接近的横向尺寸，保留原图，再裁剪到表中比例；不要拉伸图片。
- 所有图片均不包含文字、标志、水印、可辨识人物或个人信息，也不生成网页、软件界面或设备屏幕截图。
- 页面会使用居中裁剪与圆角遮罩。关键物体放在画面中间约 70% 的区域，四周保留 12%–15% 的可裁切余量，避免关键细节贴边。
- 原图比例不必等于所有屏幕下的展示比例：当前桌面封面采用 3:2，手机封面采用 4:3。主封面原图需保护左右边缘，三张日常卡片原图需保护上下边缘，以适应这两种裁剪。
- 不在图片中添加标题、按钮、装饰气泡、圆角或纯青柠色底板，这些均由网页负责呈现。照片应保留真实环境背景，不模拟页面的主题底色。
- 以纸白与浅木色建立明度层次，植物绿只作为自然物体的局部颜色，深绿黑用于少量真实物体或阴影。避免荧光绿、重度绿色滤镜与商业饮品广告布景。
- 保留自然阴影和材质细节，避免过度锐化、重度 HDR、强烈暗角和明显的人工布景感。导出 WebP 时，以木纹、纸张和植物边缘保持清晰为准适当压缩。

## 1. Curious Desk · 学习与制作的日常桌面

用途：精选项目主封面。用一个真实的工作角落传达 CS、AI 与 Web 的个人兴趣，不使用代码截图或科幻符号。

建议尺寸：**1536 × 1024，3:2 横向构图**。桌面主体略偏中间，前景有少量留白；笔记本电脑不作为占满画面的主角。

```text
Create a natural editorial photograph of a personal study and making desk beside a softly lit window, photographed on a quiet late morning. A warm wooden tabletop holds a partially closed, unbranded laptop with no visible screen, an open notebook with completely blank cream pages, a plain ceramic coffee cup, a graphite pencil, and a small green plant. Include one small, neatly assembled electronics component as a subtle sign of curiosity about computing and creative technology. The arrangement feels used and personal, with gentle asymmetry and a few imperfect details, never like a showroom or a product advertisement. Photograph from a slightly elevated three-quarter angle, with realistic proportions, tactile paper and wood grain, soft directional sunlight, delicate shadows, soft paper-white highlights, pale natural wood, restrained sage foliage, small dark charcoal-green details, and subtle fine-grain 35mm film character. Keep the important objects within the central 70 percent of the image, leaving generous crop-safe space around all edges. Landscape 3:2 composition. Photographic realism, quiet Japanese lifestyle magazine sensibility. No people, faces, hands, readable text, letters, numbers, logos, branding, watermarks, visible software interfaces, website screenshots, illustrations, or decorative overlays. Preserve natural material colors without a green color cast. No artificial solid lime-green backdrop, flat colored background, colored border, or rounded image corners.
```

## 2. Learning Notes · 留给思考的一页

用途：学习卡片。以纸张、书本和简单手绘线条表现学习过程，保持内容抽象，避免生成乱码公式或文字。

建议尺寸：**1536 × 1152，4:3 横向构图**。书本与笔记组成视觉中心，页边、铅笔和桌面可以接受少量裁切。

```text
Create an intimate editorial still-life photograph of a small learning session on a pale wooden table near a window. An open cream notebook rests beside two unbranded books with plain, completely blank covers and no visible printed pages. The notebook contains only a few light graphite sketches: a simple branching structure, several connected circles, and a loose geometric diagram, with absolutely no letters, numbers, equations, or readable writing. A sharpened pencil lies diagonally beside it, with a small plain eraser and a folded linen cloth nearby. The composition suggests patient thinking, computer science study, and ideas taking shape on paper. Use a relaxed overhead angle, natural side lighting, believable paper texture, soft shadows, paper-white tones, pale natural wood, muted sage accents and graphite-dark details, and subtle fine-grain analog film character. Keep the notebook and its main diagram inside the central 70 percent of the frame, with ample crop-safe margins. Landscape 4:3 composition, realistic quiet everyday photography with a Japanese lifestyle editorial mood. No people, faces, hands, legible text, letters, numbers, logos, branding, watermarks, screens, software interfaces, website screenshots, artificial graphics, artificial solid lime-green backdrop, flat colored background, green color cast, borders, or rounded image corners.
```

## 3. Small Experiments · 小小实验，慢慢发生

用途：实验卡片。把代码与视觉探索转译成可触摸的桌面实验，画面要轻巧、有趣，避免像硬件商品宣传照。

建议尺寸：**1536 × 1152，4:3 横向构图**。玻璃、几何物体和细线集中在中心，彩色折射可以自然延伸至空白区域。

```text
Create a realistic editorial photograph of a small playful visual experiment on a pale neutral tabletop in a sunlit home studio. Arrange a clear glass prism, two small translucent acrylic shapes, one matte ceramic sphere, and a few loosely connected thin wires beside a tiny unbranded circuit board. A restrained band of refracted light falls naturally across the table, suggesting experiments with color, logic, and creative coding without showing a computer screen. The objects should feel physically plausible, modest in scale, and casually arranged by a curious maker. Use a slightly elevated three-quarter view with a balanced but imperfect composition, ample breathing room, soft afternoon sunlight, realistic contact shadows, delicate transparent materials, soft paper whites, neutral stone tones, muted sage and translucent blue accents, and subtle fine-grain 35mm film texture. Keep the essential objects together within the central 70 percent of the frame and leave crop-safe space at every edge. Landscape 4:3 composition. Quiet Japanese editorial still-life photography, tactile and approachable rather than futuristic. No people, faces, hands, readable text, letters, numbers, labels, logos, branding, watermarks, screen content, software interfaces, website screenshots, neon cyberpunk styling, illustration, artificial solid lime-green backdrop, flat colored background, green color cast, borders, or rounded image corners.
```

## 4. Everyday Observations · 窗边的日常观察

用途：日常卡片。用阳光与植物补充生活温度，让首页不只有项目和学习。优先选择窗边植物，便于与其他三张桌面照片保持同一组视觉气质。

建议尺寸：**1536 × 1152，4:3 横向构图**。植物叶片与窗边光影是主体，窗外景色虚化，不出现可识别建筑、街牌或地址。

```text
Create a quiet, candid editorial photograph of a sunlit windowsill in an ordinary lived-in home. A small leafy green plant in a simple off-white ceramic pot sits near a clear drinking glass and a lightly folded natural linen curtain. Warm afternoon light passes through the leaves and creates gentle organic shadows on a pale wooden surface. Through the window, show only a softly blurred, anonymous hint of greenery and a neutral exterior, with no recognizable location or architectural landmark. The image should feel like a small everyday observation discovered while taking a break from study, serene and authentic rather than carefully staged. Use a close, slightly off-center composition, realistic leaf textures, soft highlight roll-off, soft paper-white highlights, pale wood tones, naturally restrained greens and delicate dark shadows, natural depth of field, and subtle fine-grain analog film character. Keep the plant and the strongest patch of light inside the central 70 percent of the image, leaving generous crop-safe margins. Landscape 4:3 composition with a calm Japanese lifestyle magazine sensibility. No people, faces, hands, readable text, letters, numbers, signs, addresses, logos, branding, watermarks, screens, software interfaces, website screenshots, illustration, artificial solid lime-green backdrop, flat colored background, green color cast, borders, or rounded image corners.
```

## 替换时的检查

1. 确认四张照片的色温、颗粒和自然光强度接近，尤其避免其中一张明显偏蓝或过度鲜艳。
2. 将文件放入 `public/images/home/`，按下表更新 `src/data/home-editorial.ts` 中 `homeEditorialCovers` 的 `src`。保留现有 `imageBase`，它已包含 `BASE_URL` 和 `images/`；只将后面的文件路径改为 `home/…`，不要重复添加 `public/` 或 `images/`。
3. 根据最终照片调整同一映射中的 `alt`，使可访问性描述与真实画面一致。图片说明仍由页面代码呈现，不烘焙进图片。
4. 分别查看桌面和手机宽度，确认居中裁剪没有切掉主体，照片中也没有意外出现文字、标志或个人信息。

| 映射键 | 当前临时 `src` | 新图片 `src` |
| --- | --- | --- |
| `featured` | `${imageBase}navigation/coding-workspace-1920.webp` | `${imageBase}home/curious-desk.webp` |
| `learning` | `${imageBase}learning/notebook.webp` | `${imageBase}home/learning-notes.webp` |
| `experiments` | `${imageBase}learning/circuits.webp` | `${imageBase}home/small-experiments.webp` |
| `everyday` | `${imageBase}navigation/forest-details-1920.webp` | `${imageBase}home/everyday-observations.webp` |
