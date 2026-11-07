# Image gallery

通用图片浏览模块，基于 [Yet Another React Lightbox](https://yet-another-react-lightbox.com/)（MIT）。不依赖项目数据、项目路由或页面结构。样式在模块内部引入，浏览器通过 portal 挂载，关闭后恢复入口焦点和页面滚动。

## 使用

```tsx
import { useState } from 'react'
import { ImageGallery, GalleryTrigger, type GalleryImage } from './components/image-gallery'

const images: GalleryImage[] = [
  { src: '/images/overview.webp', alt: '整体展示', title: '作品图集', caption: '整体效果' },
  { src: '/images/detail.webp', alt: '局部细节', title: '作品图集', caption: '细节展示' },
]

export function GalleryExample() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  return <>
    <div style={{ position: 'relative' }}>
      <img src={images[0].src} alt={images[0].alt} />
      <GalleryTrigger label="放大查看作品图片" onClick={() => setActiveIndex(0)} />
    </div>
    <ImageGallery
      images={images}
      activeIndex={activeIndex}
      onIndexChange={setActiveIndex}
      onClose={() => setActiveIndex(null)}
    />
  </>
}
```

`src` 与 `alt` 必填；`title`、`caption`、`thumbnail`、`width`、`height`、`source` 可选。`thumbnail` 可以指向较小的预览图，原图仍由 `src` 提供；`source` 会生成图片来源链接。部署在子路径时，请按页面的 `import.meta.env.BASE_URL` 构造资源地址。

`activeIndex` 为从零开始的索引，`null`、越界或非整数值关闭浏览器。`onIndexChange` 同步缩略图、方向键与手势选择。建议将静态图片列表定义在组件外，或使用 `useMemo` 保持列表引用稳定。

`GalleryTrigger` 是独立的 44px 图标按钮，放在 `position: relative` 的图片容器内。普通图片本身不绑定放大操作，避免点击图片与图标含义不一致。

## 交互

- 工具栏提供放大、缩小、重置到适应窗口、缩略图开关、全屏与关闭。
- 桌面支持滚轮、双击缩放，放大后鼠标拖动；滚轮采用较小增量，便于逐步调整细节。方向键在适应窗口时切图，放大时移动图片。主图区域的鼠标拖动和触控板横向滑动不切图。
- 缩略图区域支持滚轮逐张切换：向下或向右切到下一张，向上或向左切到上一张。小幅触控板输入会累积，动画期间忽略同向重复输入，不排队；反向滚动可以直接响应。主图区域仍用于滚轮缩放。
- 触摸设备支持左右滑动切图、双指缩放及放大后拖动，不显示左右切换按钮，也不保留隐藏的边缘点按区域。工具栏按钮点击与图片手势分别处理，拖动后首次点击也能响应。
- 切换图片时恢复适应窗口。缩略图只展示实际图片，到达首尾停止切换。
- 点击跨多张的缩略图时，立即优先准备目标原图，沿途复用缩略图连续穿行，不等待中间原图。目标原图尚未就绪时先显示预览，解码后在相同位置换成原图；预览也不可用时保留上一张可用内容。快速改选及键盘接管只兑现最新目标。
- 桌面导航按钮常态隐藏，鼠标靠近时原地淡入、离开时原地淡出，不移动或缩放；只有圆形箭头按钮可点击，Tab 聚焦也会显示按钮。方向键切图时将箭头焦点移回图片区域，避免亮圈残留。交互按主指针类型区分，不依赖窗口宽度。
- 触摸设备在首张向右滑或末张向左滑时，对应侧边显示随拖动增强的窄幅柔光，颜色沿用浏览器的暖米色高亮，上下逐渐收淡，松手后渐隐。正常切图、竖向手势、放大后的平移和多指缩放不触发光效；减少动态效果时保留无动画的边界提示。
- 单张图片同样显示缩略图和缩略图开关，只隐藏上一张、下一张箭头。不支持 Fullscreen API 的浏览器自动隐藏全屏按钮，图片浏览器仍占满可用视口。
- `Tab` / `Shift+Tab` 在浏览器内部循环；关闭按钮和 `Esc` 退出预览，点击图片周围空白不会退出；减少动态效果偏好会关闭动画。原图失败、解码失败或等待超过 8 秒时保留预览并显示“重试原图”；切图、关闭和就地重试仍可用。

`100%` 表示适应当前窗口的初始尺寸。最大缩放由原图尺寸与 `maxZoomPixelRatio` 决定，适合查看实验图中的小字。当前原图先加载；选择稳定、动画结束且当前图就绪后，隔 120 ms 按需准备相邻原图，每次最多一个推测请求。邻图使用统一的 `pageNetworkPolicy().images`：仅已知较快连接允许推测，隐藏、离线、`saveData`、弱网或缺少估计时不启动；显式选择始终可加载。选择已在准备的邻图时提升并复用同一请求。

原图工作集最多 3 个条目，成功条目只保留状态及尺寸，不长期持有 `Image` 对象。底层请求、8 秒等待上限与优先级共用 `src/lib/page-images.ts`；关闭释放本图集的消费者，不取消其他消费者仍需的请求。共享层最多保留 48 条已完成元数据，跨图路径只扩大预览图显示范围，不扩大原图工作集。取消或超时会撤下原图源，并用请求身份忽略晚到结果；浏览器可能仍完成已发送的传输，不能把撤下元素视为强制网络取消。图片字节由浏览器 HTTP 缓存负责，不增加二进制存储或缓存破坏参数。

## 维护与验证

`GalleryStage` 为相邻图片提供裁切区域；工具栏与说明位于手势区域之外，避免遮挡图片，同时让缩放引擎测量到正确的可视面积。不要仅通过修改轮播的 CSS 高度来挤出工具栏空间，否则拖动边界会与实际图片尺寸不同。

`GalleryScrollLock` 在预览挂载期间保持原有滚动条和页面尺寸，锁定外层页面及入口所在滚动容器的位置，直到关闭动画与焦点恢复完成。不要恢复默认的隐藏滚动条与补偿边距逻辑，它会与页面的 `scrollbar-gutter: stable` 重复补偿，造成正文和固定菜单跳动。

首次打开先让既有 portal、工具栏与关闭按钮呈现，再在原有淡入期间构造轮播和插件；不增加点击后下载模块的瀑布。准备阶段支持 `Esc`、关闭和焦点归还，取消后不继续挂载重内容；工具栏复用原有排版。移动端同样由 `GalleryScrollLock` 保持滚动位置，不再叠加 CSS 隐藏滚动容器的第二层锁。

启动本地服务后运行 `npm run test:gallery`。浏览器检查覆盖缩放、拖动、缩略图、全屏、键盘焦点、加载失败、横竖屏与触摸手势；沿用 `PROJECTS_TEST_URL`、`PROJECTS_BROWSER_CHANNEL`、`PROJECTS_BROWSER_EXECUTABLE` 环境变量。

生产预览另运行 `npm run test:gallery-loading`，覆盖冷打开、路径阻塞、快速改选、失败/超时恢复、邻图请求复用、节流偏好和 20 次开关循环。`node tests/gallery-loading.browser.mjs --measure` 在桌面和受限移动配置下各测 3 次冷/热打开及往返跳转；可通过 `GALLERY_BASELINE_URL` 提供旧提交的独立生产预览进行同口径对照。结果及截图只写入已忽略的 `node_modules/.cache/gallery-loading/`。具体口径、局限与阶段交接见 `docs/ux-refactor.md`。
