# 首页网页目录与近况设计提案

状态：设计评审稿。仅保存方案与压缩封面样张，尚未替换正式首页。

## 推荐方案：留白目录

保留首页浅青柠绿 `#ddecba`、纸白 `#fbfcf7`、墨绿黑 `#23352b`，延续大衬线标题、描边字、大圆角图片、细线箭头、留白和白色气泡。

页面顺序：现有 Hero → 现有介绍 → 网页目录 → 最近在做什么 → 现有 Footer。

### 网页目录

将 Selected work 替换为 **Explore my space**，中文眉题为“网页目录，从这里出发”。

桌面左侧呈现四个始终可见的文字入口，右侧放一张 3:2 横向动漫插画。沿用原精选项目的大图与侧栏重心，将原项目说明转为网站导航。图片保持完整世界观，入口信息由文字直接表达。

| 入口 | 说明 | 目标 |
| --- | --- | --- |
| About / 关于 | 认识屏幕后的我 | `/about/` |
| Learning / 学习 | 把好奇写成理解 | `/learning/` |
| Projects / 项目 | 让想法慢慢成形 | `/projects/` |
| Contact / 联系 | 从一句你好开始 | `/contact/` |

图下文字：“选一个方向，随意逛逛。”区段底部保留简短结语和跳转近况的胶囊按钮。手机端先显示横向封面，再显示两列文字目录；入口无需悬停即可发现。

### 最近在做什么

将 The journal 替换为 **Now & notes**，中文眉题为“最近在做什么”。

整合首页已有的 LiveUpdates，保留两类真实内容来源：代码动态和 RSS 阅读流。正式实施时将现有数据能力移到此处，底部不再重复渲染 LiveUpdates。

两张 3:2 封面卡片分别为“我最近在维护”和“我最近在关注”。桌面右卡下移约 60px，延续当前错位节奏；手机端改为纵向排列。两张卡片都保持可见，不用横向轮播隐藏动态。

每卡展示封面、分类标记、中文标题、短描述、2–3 条动态和一个文字入口。示意稿中的项目与阅读主题仅展示排版，不声称是最新动态。正式版展示实际来源、时间和链接，继续使用现有刷新、缓存、空状态与失败重试行为。仓库数量和关注者等统计不占首页主要版面。

## 备选方案：错位图册

目录采用两列四张插画卡片，About / Learning / Projects / Contact 各有一个明确入口，右列略下移。近况改为等高双栏，避免整页持续错位。

此方案封面更多、入口更直观，但目录区更长，较当前单张大图布局变化更大。评审稿的 Contact 暂借目录样图；如选择此方案，补做独立的“云端信笺”封面。

## 动效与响应式

- 保留既有标题入场和克制的滚动位移，避免改变当前首页动效节奏。
- 封面悬停仅轻微放大；箭头轻移，链接保持键盘焦点可见。
- 白色气泡留在装饰层，文字、图片和点击区域位于其上。
- 手机端目录保持四个入口完整可见，近况顺排，文字不依赖悬停。
- 尊重 `prefers-reduced-motion`；先可读，再增强动效。
- 交互稿集中展示两个替换区段，未模拟全站导航、Hero 和实时数据请求。

## 封面方向

通过内置 image_gen 工具生成三张样张，以现有 Projects / Studio 动漫插画为参考。共同采用精细线稿、云海建筑、白色高光、天空蓝、少量藤蔓绿与浅金；人物与场景保持连贯。图片中不加入 UI、标题或标志，所有文字仍由页面排版。

原始生成图为 1536 × 1024。这里保存 900 × 600 JPEG 评审副本，单张约 150–165 KB；高分辨率原图未加入仓库。正式采用时再准备响应式 WebP，并检查 3:2 与 4:3 裁切。

| 文件 | 用途 | 视觉主题 |
| --- | --- | --- |
| [directory.jpg](home-directory-assets/directory.jpg) | 目录主封面 | 旅人与连接不同空间的云端桥梁 |
| [making.jpg](home-directory-assets/making.jpg) | 代码动态封面 | 云端工坊中的创作者 |
| [reading.jpg](home-directory-assets/reading.jpg) | 阅读流封面 | 拱廊图书馆里的阅读者 |

## 完整生成提示词

### directory

```text
Use case: stylized-concept. Asset type: landscape 3:2 cover illustration for a personal homepage design proposal. Primary request: A poetic personal website directory cover. An original anime traveler with short dark hair and an ivory jacket stands in the middle ground on a sunlit stone terrace above a sea of clouds. Four graceful branching bridges lead to a small observatory, a library, an artisan workshop and a distant garden pavilion, giving a natural visual metaphor for different places to explore. Open sky, sparse sage foliage, drifting blank papers, a tiny restrained gold accent. One calm coherent scene, not four panels. The traveler is secondary to the inviting spacious world.
Style references: the supplied images are reference-only for the refined anime illustration style, luminous white architecture, delicate linework and atmospheric fantasy storytelling; do not copy their characters or compositions.
Art direction: polished Japanese anime key visual, graceful thin linework, beautifully painted soft light, subtly textured shading, highly readable silhouettes, pearl-white highlights, sky blue, restrained sage and pale gold. Match the reference family but quieter and slightly less saturated to sit on a light lime green webpage.
Composition: 3:2 horizontal, complete standalone artwork filling the frame. Keep all essential subjects within the central 70 percent so 4:3 crops are safe. Enough small detail to reward viewing without visual clutter.
Constraints: no readable text, letters, numbers, glyphs, formulas, logos, watermark, UI, panels, borders, rounded corners or blank placeholder blocks. Original characters, natural anatomy, opaque background.
```

### making

```text
Use case: stylized-concept. Asset type: landscape 3:2 cover illustration for a personal homepage design proposal. Primary request: An original anime maker with short dark hair and an ivory shirt working in a sunlit open-air workshop above clouds, carefully assembling a small delicate luminous geometric machine at a pale wooden desk. Airy shelves with a few tools, blank notebooks and glass objects; blue sky visible beyond the large arch, subtle green vines. Emphasize quietly making and experimenting, human curiosity, restrained fantasy. The main character and object occupy the middle 60 percent, with clean peripheral space.
Style references: the supplied images are reference-only for the refined anime illustration style, luminous white architecture, delicate linework and atmospheric fantasy storytelling; do not copy their characters or compositions.
Art direction: polished Japanese anime key visual, graceful thin linework, beautifully painted soft light, subtly textured shading, highly readable silhouettes, pearl-white highlights, sky blue, restrained sage and pale gold. Match the reference family but quieter and slightly less saturated to sit on a light lime green webpage.
Composition: 3:2 horizontal, complete standalone artwork filling the frame. Keep all essential subjects within the central 70 percent so 4:3 crops are safe. Enough small detail to reward viewing without visual clutter.
Constraints: no readable text, letters, numbers, glyphs, formulas, logos, watermark, UI, panels, borders, rounded corners or blank placeholder blocks. Original characters, natural anatomy, opaque background.
```

### reading

```text
Use case: stylized-concept. Asset type: landscape 3:2 cover illustration for a personal homepage design proposal. Primary request: An original anime reader with medium dark hair and an ivory outfit sits quietly with an open blank book in an airy fantasy library above clouds. Pale stone arches, slender bookshelves, a few floating blank pages and delicate glass mobiles catch the afternoon light. A glimpse of blue sky through the windows, subtle sage foliage. Quiet, contemplative and bright. The reader is in the center-left middle ground, with spacious architectural depth and no crowded foreground.
Style references: the supplied images are reference-only for the refined anime illustration style, luminous white architecture, delicate linework and atmospheric fantasy storytelling; do not copy their characters or compositions.
Art direction: polished Japanese anime key visual, graceful thin linework, beautifully painted soft light, subtly textured shading, highly readable silhouettes, pearl-white highlights, sky blue, restrained sage and pale gold. Match the reference family but quieter and slightly less saturated to sit on a light lime green webpage.
Composition: 3:2 horizontal, complete standalone artwork filling the frame. Keep all essential subjects within the central 70 percent so 4:3 crops are safe. Enough small detail to reward viewing without visual clutter.
Constraints: no readable text, letters, numbers, glyphs, formulas, logos, watermark, UI, panels, borders, rounded corners or blank placeholder blocks. Original characters, natural anatomy, opaque background.
```

## 验证记录

浏览器检查覆盖两种方案切换、目录点击反馈、图片解码，以及桌面和窄屏排版。此阶段未修改应用运行代码，未运行整站测试。
