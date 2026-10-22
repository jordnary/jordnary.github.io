# 最近在做什么：封面生成提示词

首页的两张封面已接入用户提供的图片，整张卡片可直接打开林间手记，不再显示 Explore 按钮。以下为最初的封面生成提示词，供后续迭代参考；最终“我最近在关注”采用自然手账、植物纸片与放大镜构图。整体阅读场景见 `docs/design/home-now-reader.md`。

## 共用规格

- 横向 **3:2**，建议 **1536 × 1024** 或更高分辨率；主体留在中央 70%，适配手机裁剪。
- 呼应 Directory 的纸面插画：米白纸纹、细铅笔线、柔和水彩、灰绿植物与暖光，少量橙色点缀。
- 只生成插画，不生成网页、卡片边框、圆角、标题或 Explore 按钮；这些由页面渲染。
- 两张图使用接近的纸色、线条粗细、光照和细节密度。避免可读文字、品牌、可识别地点及个人信息。

## 我最近在维护 / What I’m building

主题：一间仍在生长的微型工作室。用搭建、连接与修补表达持续维护项目。

**English prompt**

```text
A quiet miniature workshop still being built and cared for, shown as an elegant architectural cutaway in three-quarter isometric perspective. On an ivory paper ground, a small modular studio contains a wooden workbench, precisely arranged unmarked components, a few simple tools, a softly glowing abstract device, and a young green plant. One side of the structure is complete and warmly lit; the other gently dissolves into fine graphite construction lines, suggesting ongoing improvements rather than an abandoned building. A single thin muted terracotta-orange line connects a few modules like a thoughtful path through a growing project. Delicate architectural pencil drawing blended with translucent watercolor washes, tactile off-white paper grain, restrained sage greens, warm wood, soft graphite gray, and small amber highlights. Calm daylight, subtle depth, intimate human scale, careful but imperfect handmade detail. An editorial illustration about tending to ideas over time. Airy landscape 3:2 composition, 1536 by 1024 pixels, focal objects within the central 70 percent, generous quiet margins. No people, readable text, letters, numbers, labels, logos, code, screens showing interfaces, website mockups, borders, rounded corners, watermarks, recognizable locations, neon colors, or glossy 3D rendering.
```

**中文提示词**

```text
横向 3:2、1536×1024 的安静微型工作室插画，采用建筑剖面与三分之四轴测视角。米白纸面上，一间模块化小工作室内有木质工作台、摆放有序的无标记零件、少量简单工具、柔和发光的抽象装置和一株嫩绿植物。建筑的一侧完整且透出暖光，另一侧逐渐化为细腻的石墨构造线，表达持续改进和维护。用一根低饱和陶橙色细线连接几个模块，像穿过成长中项目的思路线索。精细建筑铅笔线与透明水彩叠染，带米白纸纤维质感；鼠尾草绿、暖木色、柔和石墨灰，辅以少量琥珀光。自然日光、细腻层次、亲切尺度，保留手工的不完美。画面轻盈，主体位于中央 70%，四周留出安静的裁剪余量。不要人物、可读文字、字母、数字、标签、标志、代码、软件界面、网页效果图、边框、圆角、水印、可识别地点、霓虹色或光滑的商业三维渲染。
```

## 我最近在关注 / What I’m following

主题：一座收集新想法的阅读温室。用书页、光线和植物表达阅读与关注，形成同系列的第二幅画。

**English prompt**

```text
A small reading conservatory for collecting new ideas, illustrated as a delicate architectural cutaway in three-quarter isometric perspective on warm ivory paper. A low wooden reading table holds a few open books with completely blank pages, translucent loose sheets, and simple unmarked bookmarks. Nearby, slender shelves and a clear glass wall frame climbing sage-green plants. A few blank paper leaves drift gently from the open window toward the table, connected by one subtle muted terracotta-orange thread, suggesting discoveries arriving from different places. Use a single calm visual focus and plenty of breathing room, with no crowded collage. Fine graphite architectural linework, translucent watercolor shading, tactile paper fibers, soft stone gray, warm pale wood, restrained olive and sage greens, and a small pool of afternoon amber sunlight. Thoughtful, curious, serene, like an illustration in an independent architecture and culture journal. Match the visual language and paper tone of a companion miniature workshop illustration. Landscape 3:2 composition, 1536 by 1024 pixels, important objects within the central 70 percent and crop-safe margins. No people, readable text, letters, numbers, printed book covers, newspaper headlines, logos, screens, website UI, borders, rounded corners, watermarks, recognizable landmarks, saturated neon colors, or glossy 3D rendering.
```

**中文提示词**

```text
横向 3:2、1536×1024 的阅读温室插画，以温暖米白纸为底，采用细腻的建筑剖面和三分之四轴测视角。低矮木质阅读桌上放几本书页完全空白的打开书籍、半透明散页和无标记书签；旁边的轻薄书架与透明玻璃墙围合着攀援的灰绿植物。几片空白纸页从打开的窗边轻轻飘向桌面，一根低饱和陶橙色细线隐约将它们串起，表达来自不同地方的新发现。主体明确、构图疏朗，不要堆成信息拼贴。细石墨建筑线稿、透明水彩阴影、可见纸纤维；柔和石灰色、浅暖木色、克制的橄榄绿与鼠尾草绿，一小片午后琥珀色阳光。安静、好奇、专注，像独立建筑与文化刊物中的插画。与配套的微型工作室图保持一致的纸色、线条和光感。重要物件集中在中央 70%，边缘保留裁剪空间。不要人物、可读文字、字母、数字、印字书封、新闻标题、标志、屏幕、网页界面、边框、圆角、水印、可识别地标、高饱和霓虹色或光滑的商业三维渲染。
```

## 接入记录

两张原图以原始 1536 × 1024 分辨率转为 WebP，去除嵌入元数据，保存在 `public/images/home/now-building.webp` 和 `public/images/home/now-following.webp`。`src/data/home-editorial.ts` 的 `homeNow` 对应条目已配置 `src` 和描述实际画面的 `alt`：

```ts
src: `${imageBase}home/now-building.webp`,
alt: '暖光与绿植环绕的木质工作室，一侧结构延伸为细铅笔线稿',
```

图册沿用现有懒加载、3:2 比例、灰度切换和悬停效果，Explore 与浮层交互保持不变。原始 PNG 继续由 Git 忽略，版本库仅保留优化后的 WebP。
