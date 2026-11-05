import { getPageScrollTop, getPageScrollLeft, scrollPageTo, getPageScroller } from '../../lib/pageScrollSource'
import { useLayoutEffect, useState, type PropsWithChildren } from 'react'
import { ACTION_CLOSE, useEvents, useLightboxProps } from 'yet-another-react-lightbox'
import { usePaintedContent } from '../../lib/usePaintedContent'
import { GalleryIcon } from './GalleryIcon'

export function GalleryScrollLock({ children }: PropsWithChildren) {
  const [closing, setClosing] = useState(false)
  const ready = usePaintedContent(!closing)
  const { publish } = useEvents()
  const { toolbar, render } = useLightboxProps()
  const close = () => { setClosing(true); publish(ACTION_CLOSE) }
  useLayoutEffect(() => {
    const root = getPageScroller()
    const scrollBehavior = root.style.scrollBehavior
    const left = getPageScrollLeft()
    const top = getPageScrollTop()
    const ancestors = new Map<HTMLElement, { left: number; top: number }>()
    // Focus restoration can also move an article's independent scroll container.
    for (let element = document.activeElement?.parentElement; element && element !== root; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        ancestors.set(element, { left: element.scrollLeft, top: element.scrollTop })
      }
    }

    // Keep native scrollbar and viewport geometry intact, including stable gutters.
    // Hiding overflow and adding padding can compensate the same gutter twice.
    root.style.scrollBehavior = 'auto'
    const restorePosition = () => {
      let moved = false
      if (getPageScrollLeft() !== left || getPageScrollTop() !== top) {
        scrollPageTo({ left, top, behavior: 'instant' })
        moved = true
      }
      for (const [element, position] of ancestors) {
        if (element.scrollLeft !== position.left || element.scrollTop !== position.top) {
          element.scrollTo({ ...position, behavior: 'instant' })
          moved = true
        }
      }
      return moved
    }
    // Stop any smooth scroll already in progress when the image is opened.
    scrollPageTo({ left, top, behavior: 'instant' })
    const keepPosition = (event: Event) => {
      if (restorePosition()) event.stopImmediatePropagation()
    }
    const inGallery = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('.image-gallery'))
    const blockOutsideWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !inGallery(event.target)) event.preventDefault()
    }
    const blockOutsideTouch = (event: TouchEvent) => {
      if (event.touches.length === 1 && !inGallery(event.target)) event.preventDefault()
    }
    const blockPageKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)
        && !(event.target instanceof Element && event.target.closest('button, input, textarea, select, [contenteditable], .gallery-caption-content'))) {
        event.preventDefault()
      }
    }
    window.addEventListener('scroll', keepPosition, { capture: true, passive: true })
    window.addEventListener('wheel', blockOutsideWheel, { capture: true, passive: false })
    window.addEventListener('touchmove', blockOutsideTouch, { capture: true, passive: false })
    window.addEventListener('keydown', blockPageKeys, true)
    return () => {
      // Keep the lock through the closing fade and the viewer's focus restoration.
      restorePosition()
      window.removeEventListener('scroll', keepPosition, true)
      window.removeEventListener('wheel', blockOutsideWheel, true)
      window.removeEventListener('touchmove', blockOutsideTouch, true)
      window.removeEventListener('keydown', blockPageKeys, true)
      root.style.scrollBehavior = scrollBehavior
    }
  }, [])

  // The original portal owns its fade, inert siblings and focus restoration.
  // Paint that cancellable surface before measuring the carousel and plugins.
  return ready ? children : <div className="gallery-opening" aria-busy="true" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); close() }
  }}>
    <div className="yarl__toolbar">
      {toolbar.buttons[0]}
      {render.buttonZoom?.({ zoom: 1, minZoom: 1, maxZoom: 1, offsetX: 0, offsetY: 0, disabled: true,
        zoomIn: () => {}, zoomOut: () => {}, changeZoom: () => {} })}
      <button type="button" className="yarl__button" aria-label="隐藏缩略图" disabled><GalleryIcon name="thumbnails" /></button>
      {document.fullscreenEnabled && <button type="button" className="yarl__button" aria-label="进入全屏" disabled><GalleryIcon name="expand" /></button>}
      <button type="button" className="yarl__button" aria-label="关闭图片预览" title="关闭图片预览" autoFocus onClick={close}>
        <GalleryIcon name="close" />
      </button>
    </div>
  </div>
}
