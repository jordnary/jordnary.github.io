import { useEffect, type RefObject } from 'react'
import { pageNavigationScrollEvent, getPageScrollTop, scrollPageBy, getPageViewportHeight } from './pageScrollSource'

/** Smooth each wheel on one surface; only a subsequent wheel can hand off. */
export function useProjectReaderWheel(scrollRef: RefObject<HTMLElement | null>, paused: boolean) {
  useEffect(() => {
    const article = scrollRef.current
    const reader = article?.closest<HTMLElement>('.project-reader')
    if (!article || !reader || paused) return

    const events = new AbortController()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previousTime = 0
    let pending = 0
    let fraction = 0
    const wheels: number[] = []
    let target: 'article' | 'page' | null = null
    let point: { x: number; y: number } | null = null
    let controlledWheel: WheelEvent | null = null
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      pending = 0
      fraction = 0
      wheels.length = 0
      target = null
    }

    const overArticle = (x: number, y: number) => article.contains(document.elementFromPoint(x, y))
    const movePoint = (x: number, y: number) => {
      if (point?.x === x && point.y === y) return
      if (point && (pending || fraction) && overArticle(point.x, point.y) !== overArticle(x, y)) stop()
      point = { x, y }
    }

    const scrollStep = (distance: number) => {
      // Test the actual movement: rounded scrollHeight/clientHeight can hide
      // the last pixel (or report one that the browser cannot scroll).
      if (target === 'article' || (!target && point && overArticle(point.x, point.y))) {
        const before = article.scrollTop
        const scale = Number.parseFloat(getComputedStyle(article).zoom) || 1
        article.scrollBy({ top: distance / scale, behavior: 'instant' })
        if (article.scrollTop !== before) {
          target = 'article'
          return true
        }
        if (target === 'article') return false
      }
      target = 'page'
      const before = getPageScrollTop()
      scrollPageBy({ top: distance, behavior: 'instant' })
      return getPageScrollTop() !== before
    }

    const advance = (time: number) => {
      frame = 0
      const elapsed = previousTime ? Math.min(48, time - previousTime) : 16
      previousTime = time
      let budget = motion.matches ? Math.abs(pending) : Math.max(1, Math.floor(Math.abs(pending) * (1 - Math.exp(-elapsed / 70))))
      // A frame may cover several inputs, or just part of one. Drop only the
      // blocked wheel's remainder; later wheels keep their full distance.
      while (budget > 0 && wheels.length) {
        const step = Math.sign(pending) * Math.min(budget, Math.abs(wheels[0]))
        const used = scrollStep(step) ? step : wheels[0]
        pending -= used
        wheels[0] -= used
        budget -= Math.abs(step)
        if (!wheels[0]) { wheels.shift(); target = null }
      }
      if (wheels.length) frame = requestAnimationFrame(advance)
      else previousTime = 0
    }

    const wheel = (event: WheelEvent) => {
      if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey
        || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { stop(); return }
      // Cancel from the first wheel so the browser cannot lock a continuous
      // gesture to the old scroll container. Touch and keyboard remain native.
      event.preventDefault()
      controlledWheel = event
      movePoint(event.clientX, event.clientY)
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? Number.parseFloat(getComputedStyle(article).lineHeight) || 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? getPageViewportHeight() : 1
      const distance = event.deltaY * unit
      if ((pending + fraction) * distance < 0) stop()
      fraction += distance
      const pixels = Math.trunc(fraction)
      if (!pixels) return
      fraction -= pixels
      wheels.push(pixels)
      pending += pixels
      if (motion.matches) {
        cancelAnimationFrame(frame)
        advance(performance.now())
      } else if (!frame) frame = requestAnimationFrame(advance)
    }

    reader.addEventListener('wheel', wheel, { passive: false, signal: events.signal })
    window.addEventListener('wheel', event => {
      if (event !== controlledWheel) stop()
      controlledWheel = null
    }, { passive: true, signal: events.signal })
    window.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch') movePoint(event.clientX, event.clientY)
    }, { passive: true, signal: events.signal })
    for (const type of ['pointerdown', 'keydown', 'touchstart', 'resize', 'blur', pageNavigationScrollEvent]) {
      window.addEventListener(type, stop, { passive: true, signal: events.signal })
    }
    document.addEventListener('visibilitychange', stop, { signal: events.signal })
    motion.addEventListener('change', stop, { signal: events.signal })
    return () => { stop(); events.abort() }
  }, [scrollRef, paused])
}
