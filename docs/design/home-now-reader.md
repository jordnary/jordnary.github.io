# Now & notes：林间手记

整个阅读空间是一幅围绕文字生长的林间插画。木屋位于左上，枝叶沿四周延伸，蕨草和小径收束在底部；中央暖纸色留白承载真实 GitHub 与 RSS 内容。装饰不独立分栏，正文下方的柔和纸色薄层保持文字对比度。背景采用摄影式景深：小屋、暖窗与门前苔石处于清晰焦平面，近处枝叶自然散焦，远林逐层融入薄雾。虚实关系直接绘入素材，页面无需重复图片、圆形清晰遮罩或实时 blur 滤镜。

## 排版与操作

- 整张近况卡片是入口，不显示 Explore 浮层。
- 正文使用本地 Woodland WenKai，英文标题使用本地 Instrument Serif。
- 正文与描述基准为 17–18px，阅读条目标题为 20–21px；中文标题 22–29px。仓库名在左侧使用 36–48px 的 Instrument Serif 斜体大字，右侧放简介与元信息；列表宽度不超过 520px 时改为上下布局，仓库名为 34–44px，长名称自然换行。文字随阅读窗口适度等比缩小，桌面最小为基准的 90%，手机最小为 85%；关闭按钮的实际点击高度保持 44px。
- 阅读列最大 660px，正文约 1.9 倍行高。元信息保持清晰的次级层次。
- 阅读窗口在所有屏幕上保持桌面构图的横向 3:2 比例，包括手机竖屏。统一使用横向背景，四周保留留白，宽、高同时受视口可用空间限制，不切换竖版，也不随浏览器单独拉长某一边。完整展示背景，不拉伸或裁切插画；小屏幕收紧顶部、底部和标题间距，为滚动正文保留空间。
- 内部滚动区隐藏滚动条，保留滚轮、触控、PageDown 与键盘焦点。底部短线和文字提示阅读进度。
- 两个阅读界面的左上角均不显示标题标记。右上角只保留简洁线条 ×，无可见文字、按钮底色、边框或阴影。图标保持 24px 的实际尺寸，使用柔和灰绿色的适中笔画，不加白色描边，并向内收进，留出更自然的边缘间距。悬停或键盘聚焦时颜色稍加深，图标在 320ms 内顺时针旋转 90° 并轻微缩小，离开后平滑复位；减少动态效果模式直接切换状态。关闭按钮保留 44×44px 点击区与屏幕阅读器名称；支持 Escape、背景点击、键盘焦点提示与焦点归还。

## 连续过渡

打开时记录实际封面位置、图像变换、灰度和透明度。原生 dialog 从该位置扩展，封面与纸面交叉淡化；关闭时预置来源卡片归还后的焦点与悬停状态，再测量并逆向归位，避免落回后发生第二次缩放。原生焦点归还后立即清除临时状态。

动画使用预计算的 Web Animations 关键帧，只动态改变 transform 与 opacity。窗口、背景与正文从打开到关闭始终等比缩放，取消内容层的反向放大裁切。卡片与阅读窗口比例不同时，以卡片中心为起点等比缩放并淡入淡出，不把窗口强行变形成卡片。动画不逐帧读取布局，不动画模糊或圆角，不使用全屏 backdrop-filter。提前关闭从当前视觉状态接续；窗口变化与减少动态效果偏好均能清理动画。

画廊接近视口时预热背景与字体，减少首次点击时的解码竞争。字体保留完整上游字符覆盖，常用字与补充分包按 unicode-range 加载。

滚动锁定保留背景页面原有滚动条和布局，不切换 overflow 或 scrollbar-gutter，避免传统滚动条环境下 vw 重算导致卡片和页面高度跳动。滚轮与触控只允许阅读区滚动，滚动键导向正文；捕获被拒绝的背景滚动，在主页视差监听器执行前还原原位置。关闭后清理监听器并归还焦点。

## 插画提示词

仓库条目的行间距为零，分隔线与链接的上下边缘对齐。仅在右侧下沿保留镂空植物卷草花纹，由细线、弧线、叶形构成；不使用上沿装饰。花纹贴着下边线向条目内舒展，鼠标悬停或键盘聚焦时从左至右展开，离开时也从左至右擦除。退出时固定右侧展开边缘，只擦除已显示部分；擦除尚未完成就重新进入时，用至多 100ms 向右清除剩余部分，再从左端重新展开，避免把已擦除的左边缘反向恢复。新的移入、移出会取消过期的接续动作，只响应当前悬停或聚焦状态。条目背景保持透明。窄屏花纹仍靠右，内容下方预留空间；减少动态效果模式直接切换显隐。

卷草花纹使用内置 `image_gen` 生成，部署文件为 `public/images/home/repository-flourish.webp`。转换为 WebP 时保留原始尺寸与透明通道，不写入元数据；原始 PNG 不纳入版本控制。完整生成提示词：

> Use case: stylized-concept. Asset type: ONE transparent lower-right ornamental flourish for a refined woodland journal website. Input image: STYLE REFERENCE ONLY for hollow open contours, lyrical curved leaves, and fine minimalist botanical line art. Create a sophisticated botanical ARABESQUE / Art Nouveau manuscript flourish, not a literal ivy vine. Compose a slim asymmetric accent that flows horizontally from a bare hairline at the LEFT into a graceful airy cluster of elegant elongated open leaf shapes and delicate curled tendrils at the RIGHT. The design is restrained but exquisitely drawn: 3 sweeping interwoven curves with tapering endpoints, 5 to 7 slim hollow lanceolate leaf/petal forms, two or three delicate open scroll curls, all arranged harmoniously like a botanical calligraphic flourish. Main direction left to right; silhouette gently widens toward the right. This is a LOWER edge ornament: every leaf and scroll curves UPWARD from a nearly horizontal bottom baseline, with NO ink below the baseline. Keep most foliage at the rightmost third; the left half is primarily a fine gently sweeping lead-in. Canvas approximately 3:1 landscape, entire ornament centered vertically with transparent empty space above and below; actual ornament very shallow, about 9:1 width to height, spanning 96% of canvas width. Entire shape and tips visible, no crop. Refined muted olive-gray single ink color (#7b8967). Truly thin smooth confident outlines, around 3 to 4 pixels at 2100px output width, elegantly tapering; avoid chunky strokes, heavy double-line stems, sharp kinks, rigid symmetry, and evenly spaced repeated leaves. Leaf interiors must be completely TRANSPARENT, with only their outline and an occasional single inner curve. No filled leaf bodies, no shading, no gradients, no color wash, no photorealism, no texture, no paper, no background rectangle, no checkerboard, no flower heads, no text. A simple light openwork botanical flourish with artisanal precision, not a complex dense baroque engraving, not a garland spanning a whole frame.

桌面背景：横向 3:2，细腻植物学水彩与铅笔，暖奶油纸与清晨雾光。四周有枝叶、蕨草、苔石，左上角有小暖窗木屋，右上稀疏叶枝，底角有小径线索。中央约 65% 宽、从上方 20% 至底部 90% 为平静浅色留白。装饰自然羽化，没有分栏、硬边或矩形白框。低饱和森林绿与琥珀点缀，无人物、文字、标志或界面。

备用竖版素材（当前阅读窗口不使用）：以桌面背景作为风格参考，重新绘制竖向 2:3 构图。小屋位于左上，宽度不超过约 25%、高度不超过约 15%；中央约 80% 宽的正文区域保持连续奶油留白。枝叶和蕨草只在窄边与底角，延续相同水彩笔触、薄雾与暖光。

景深编辑：保留原构图与水彩质感，将焦点放在左上木屋，清晰呈现屋檐、木结构、暖窗和门前苔石。极近的顶部、右侧与底角枝叶呈自然光学散焦，远处森林渐渐失焦并融入薄雾；避免全图高斯模糊、圆形清晰洞、正文区散景光斑。中央连续奶油留白不变。

插画使用内置图像生成工具制作，部署使用无元数据 WebP；高分辨率 PNG 不纳入版本控制。

## 验证入口

`tests/home-now.browser.mjs` 覆盖多尺寸布局、真实字体加载、隐藏滚动条、数据加载与错误恢复、卡片来源几何、提前反向、重复 Escape、窗口变化、焦点及滚动锁。性能采样区分首轮与预热后的动画，记录帧间距，不用单机结果承诺所有设备的帧率。

`tests/home-now-scroll-lock.browser.mjs` 使用真实经典滚动条与覆盖式滚动条，分别验证按钮与 Escape 关闭。逐帧记录页面几何和滚动位置，并实际拖动背景滚动条，确保关闭时页面不会跳动。

`tests/home-now-focus-return.browser.mjs` 覆盖按钮关闭、Escape 时指针位于卡片内外、快速关闭与再次打开，验证回落后没有二次缩放、焦点描边保留且临时状态完整清理。

`tests/home-now-ornament.browser.mjs` 逐帧检查擦除中重新进入、上下条目快速来回切换时的显隐方向，并检查最终悬停状态、键盘聚焦、减少动态效果和关闭时的动画清理。`npm run test:home-now` 运行这四组检查。
