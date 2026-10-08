import { useMemo, useRef, type KeyboardEvent, type PropsWithChildren, type TouchEvent } from 'react'
import Lightbox, { createModule, useLightboxState, useMotionPreference, type Plugin, type ZoomRef } from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import { SmartLink } from '../SmartLink'
import { GalleryIcon } from './GalleryIcon'
import type { GalleryImage, ImageGalleryProps } from './types'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import './ImageGallery.css'

function GalleryStage({ children }: PropsWithChildren) {
  return <div className="gallery-stage">{children}</div>
}

// Clip neighboring slides without clipping the toolbar outside the measured stage.
const StageBoundary: Plugin = ({ addParent }) => addParent('carousel', createModule('gallery-stage', GalleryStage))
const plugins = [StageBoundary, Zoom, Thumbnails, Fullscreen]
const labels = {
  Lightbox: '图片浏览器',
  'Photo gallery': '图片浏览区域',
  Carousel: '图集',
  Slide: '图片',
  Previous: '上一张图片',
  Next: '下一张图片',
  Close: '关闭图片预览',
  'Zoom in': '放大图片',
  'Zoom out': '缩小图片',
  'Enter Fullscreen': '进入全屏',
  'Exit Fullscreen': '退出全屏',
  Thumbnails: '图片缩略图',
  'Show thumbnails': '显示缩略图',
  'Hide thumbnails': '隐藏缩略图',
  '{index} of {total}': '第 {index} 张，共 {total} 张',
}

// Keep Tab within the entire portal, including the thumbnail strip.
function containFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab') return
  const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], [tabindex="0"]',
  )).filter(element => element.getClientRects().length > 0
    && getComputedStyle(element).visibility === 'visible'
    && !element.matches(':disabled')
    && !element.closest('[inert], [aria-hidden="true"]'))
  const first = elements[0]
  const last = elements.at(-1)
  const active = document.activeElement
  if (event.shiftKey && (active === first || !elements.includes(active as HTMLElement))) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && (active === last || !elements.includes(active as HTMLElement))) {
    event.preventDefault()
    first?.focus()
  }
}

function useTouchButtons() {
  const press = useRef<{ button: HTMLButtonElement; x: number; y: number } | null>(null)
  return {
    onTouchStart: (event: TouchEvent<HTMLDivElement>) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      const touch = event.touches[0]
      press.current = button && !button.disabled && event.touches.length === 1
        ? { button, x: touch.clientX, y: touch.clientY } : null
    },
    onTouchMove: (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0]
      if (press.current && (event.touches.length !== 1 || Math.hypot(touch.clientX - press.current.x, touch.clientY - press.current.y) > 10)) press.current = null
    },
    onTouchCancel: () => { press.current = null },
    onTouchEnd: (event: TouchEvent<HTMLDivElement>) => {
      const target = press.current?.button
      press.current = null
      if (!target || target.disabled || !target.isConnected || !event.cancelable || event.touches.length) return
      // A drag can suppress the browser's next compatibility click. Activate a
      // deliberate button tap directly and suppress any duplicate native click.
      event.preventDefault()
      target.focus({ preventScroll: true })
      target.click()
    },
  }
}

function GalleryHeading({ images }: { images: readonly GalleryImage[] }) {
  const { currentIndex } = useLightboxState()
  return <div className="gallery-heading" aria-live="polite" aria-atomic="true">
    <p>IMAGE VIEWER <span>{String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</span></p>
    <h2>{images[currentIndex]?.title || '图片预览'}</h2>
  </div>
}

function GalleryCaption({ images }: { images: readonly GalleryImage[] }) {
  const { currentIndex } = useLightboxState()
  const current = images[currentIndex]
  return <div className="gallery-caption">
    <div className="gallery-caption-content">
      <p aria-live="polite">{current?.caption || current?.alt}</p>
      {current?.source && <SmartLink href={current.source} className="gallery-source" aria-label="查看图片来源" title="查看图片来源"><GalleryIcon name="external" /></SmartLink>}
    </div>
    <p className="gallery-hint"><span className="gallery-hint-desktop">滚轮缩放 · 双击放大 · 放大后拖动 · ← → 切换 · Esc 关闭</span><span className="gallery-hint-touch">左右滑动切换 · 双指缩放 · 放大后拖动</span></p>
  </div>
}

function ZoomControls({ zoom, minZoom, maxZoom, disabled, zoomIn, zoomOut, changeZoom }: ZoomRef) {
  return <div className="gallery-zoom" role="group" aria-label="图片缩放">
    <button className="yarl__button" type="button" aria-label="缩小图片" title="缩小图片" disabled={disabled || zoom <= minZoom} onClick={zoomOut}><GalleryIcon name="minus" /></button>
    <button className="yarl__button gallery-zoom-reset" type="button" aria-label="重置图片缩放" title="适应窗口（重置缩放）" disabled={disabled} onClick={() => changeZoom(1)}>
      <GalleryIcon name="reset" /><span>{Math.round(zoom * 100)}%</span>
    </button>
    <button className="yarl__button" type="button" aria-label="放大图片" title="放大图片" disabled={disabled || zoom >= maxZoom} onClick={zoomIn}><GalleryIcon name="plus" /></button>
  </div>
}

/** Controlled, project-independent viewer. Null or an invalid index closes it. */
export function ImageGallery({ images, activeIndex, onIndexChange, onClose }: ImageGalleryProps) {
  const reducedMotion = useMotionPreference()
  const touchButtons = useTouchButtons()
  const slides = useMemo(() => images.map(({ src, alt, thumbnail, width, height }) => ({ src, alt, thumbnail, width, height })), [images])
  const open = activeIndex !== null && Number.isInteger(activeIndex) && Boolean(images[activeIndex])
  // The thumbnail plugin shares this window with the carousel.
  const preload = Math.min(6, Math.max(0, images.length - 1))
  return <Lightbox
    open={open}
    close={onClose}
    index={activeIndex ?? 0}
    slides={slides}
    plugins={plugins}
    labels={labels}
    className={`image-gallery${images.length < 2 ? ' image-gallery-single' : ''}`}
    portal={{ container: { onKeyDown: containFocus, ...touchButtons } }}
    on={{ view: ({ index }) => { if (index !== activeIndex) onIndexChange(index) } }}
    carousel={{ finite: true, preload, padding: '16px', spacing: '20%' }}
    controller={{ closeOnBackdropClick: true }}
    animation={{ fade: reducedMotion ? 0 : 180, swipe: reducedMotion ? 0 : 300, zoom: reducedMotion ? 0 : 220 }}
    zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 1.5, scrollToZoom: true, doubleClickMaxStops: 2 }}
    thumbnails={{ width: 88, height: 58, border: 2, borderRadius: 8, padding: 3, gap: 12, imageFit: 'contain', vignette: false, showToggle: images.length > 1 }}
    toolbar={{ buttons: [<GalleryHeading key="heading" images={images} />, 'zoom', 'thumbnails', 'fullscreen', 'close'] }}
    render={{
      buttonZoom: props => <ZoomControls {...props} />,
      buttonPrev: images.length < 2 ? () => null : undefined,
      buttonNext: images.length < 2 ? () => null : undefined,
      buttonThumbnails: ({ visible, show, hide }) => images.length > 1 ? <button className="yarl__button" type="button" aria-label={visible ? '隐藏缩略图' : '显示缩略图'} title={visible ? '隐藏缩略图' : '显示缩略图'} aria-pressed={visible} onClick={visible ? hide : show}><GalleryIcon name="thumbnails" /></button> : null,
      iconPrev: () => <GalleryIcon name="previous" />,
      iconNext: () => <GalleryIcon name="next" />,
      iconClose: () => <GalleryIcon name="close" />,
      iconEnterFullscreen: () => <GalleryIcon name="expand" />,
      iconExitFullscreen: () => <GalleryIcon name="collapse" />,
      iconError: () => <div className="gallery-error" role="status"><GalleryIcon name="error" /><p>图片暂时未能加载</p><small>可以切换其他图片，或关闭后重试</small></div>,
      controls: () => <GalleryCaption images={images} />,
    }}
  />
}
