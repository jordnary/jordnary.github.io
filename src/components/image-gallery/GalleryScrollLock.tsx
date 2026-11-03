import { getPageScrollTop, getPageScrollLeft, scrollPageTo, getPageScroller } from '../../lib/pageScrollSource'
import { useLayoutEffect, type PropsWithChildren } from 'react'

export function GalleryScrollLock({ children }: PropsWithChildren) {
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

  return children
}
