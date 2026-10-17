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

`activeIndex` 为从零开始的索引，`null`、越界或非整数值关闭浏览器。`onIndexChange` 同步缩略图、方向键与手势选择。建议将静态图片列表定义在组件外，或使用 `useMemo` 保持列表引用稳定。原有 `ImageGalleryDialog` 入口保留兼容导出。

`GalleryTrigger` 是独立的 44px 图标按钮，放在 `position: relative` 的图片容器内。普通图片本身不绑定放大操作，避免点击图片与图标含义不一致。

## 交互

- 工具栏提供放大、缩小、重置到适应窗口、缩略图开关、全屏与关闭。
- 桌面支持滚轮、双击缩放，放大后鼠标拖动；方向键在适应窗口时切图，放大时移动图片。主图区域的鼠标拖动和触控板横向滑动不切图。
- 缩略图区域支持滚轮逐张切换：向下或向右切到下一张，向上或向左切到上一张。小幅触控板输入会累积，动画期间忽略同向重复输入，不排队；反向滚动可以直接响应。主图区域仍用于滚轮缩放。
- 触摸设备支持左右边缘点按、左右滑动切图、双指缩放及放大后拖动。按钮点击与图片手势分别处理，拖动后首次点击也能响应。
- 切换图片时恢复适应窗口。缩略图只展示实际图片，到达首尾停止切换。
- 桌面导航仅圆形箭头按钮可点击，悬停与 Tab 聚焦使用相同的图标高亮。方向键切图时将箭头焦点移回图片区域，避免亮圈残留；触摸设备直接显示可用箭头，并扩大到左右边缘区域。交互按主指针类型区分，不依赖窗口宽度。
- 单张图片同样显示缩略图和缩略图开关，只隐藏上一张、下一张箭头。不支持 Fullscreen API 的浏览器自动隐藏全屏按钮，图片浏览器仍占满可用视口。
- `Tab` / `Shift+Tab` 在浏览器内部循环；`Esc` 关闭；减少动态效果偏好会关闭动画。加载失败时仍可切图和关闭。

`100%` 表示适应当前窗口的初始尺寸。最大缩放由原图尺寸与 `maxZoomPixelRatio` 决定，适合查看实验图中的小字。相邻图片按需预加载，不会一次请求整个图集。

## 维护与验证

`GalleryStage` 为相邻图片提供裁切区域；工具栏与说明位于手势区域之外，避免遮挡图片，同时让缩放引擎测量到正确的可视面积。不要仅通过修改轮播的 CSS 高度来挤出工具栏空间，否则拖动边界会与实际图片尺寸不同。

启动本地服务后运行 `npm run test:gallery`。浏览器检查覆盖缩放、拖动、缩略图、全屏、键盘焦点、加载失败、横竖屏与触摸手势；沿用 `PROJECTS_TEST_URL`、`PROJECTS_BROWSER_CHANNEL`、`PROJECTS_BROWSER_EXECUTABLE` 环境变量。
