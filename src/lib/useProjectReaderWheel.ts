import { useEffect, type RefObject } from 'react'
import { pageNavigationScrollEvent, getPageScrollTop, scrollPageBy, getPageViewportHeight } from './pageScrollSource'

type ReaderWheel = { remaining: number; precise: boolean; target: 'article' | 'page' | null }

// WheelEvent has no portable device ID. This hint affects only the visual cue,
// never scroll ownership: line/page wheels and conventional mouse ticks skip it.
function isPreciseWheel(event: WheelEvent & { momentum?: boolean; wheelDeltaY?: number }) {
  return event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
    && (event.momentum || !event.wheelDeltaY || Math.abs(event.wheelDeltaY) % 120 !== 0)
}

/** Smooth each wheel on one surface; only a subsequent wheel can hand off. */
export function useProjectReaderWheel(scrollRef: RefObject<HTMLElement | null>, paused: boolean) {
  useEffect(() => {
    const article = scrollRef.current
    const reader = article?.closest<HTMLElement>('.project-reader')
    if (!article || !reader || paused) return

    const events = new AbortController()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sheet = article.querySelector<HTMLElement>('.project-reader-document')
    let rebound: Animation | undefined
    let direction = 0
    let frame = 0
    let previousTime = 0
    let pending = 0
    let fraction = 0
    const wheels: ReaderWheel[] = []
    let point: { x: number; y: number } | null = null
    let controlledWheel: WheelEvent | null = null
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      pending = 0
      fraction = 0
      wheels.length = 0
      rebound?.cancel()
      rebound = undefined
    }

    const overArticle = (x: number, y: number) => article.contains(document.elementFromPoint(x, y))
    const movePoint = (x: number, y: number) => {
      if (point?.x === x && point.y === y) return
      if (point && (pending || fraction) && overArticle(point.x, point.y) !== overArticle(x, y)) stop()
      point = { x, y }
    }

    const showEdge = (input: ReaderWheel, remainder: number) => {
      if (!input.precise || motion.matches || !sheet) return
      // More unused travel produces diminishing displacement, capped at 16px.
      const pull = -Math.sign(remainder) * (3 + 13 * (1 - Math.exp(-Math.abs(remainder) / 32)))
      rebound?.cancel()
      rebound = sheet.animate([
        { transform: 'translateY(0)', easing: 'cubic-bezier(.18,.7,.32,1)' },
        { transform: `translateY(${pull}px)`, offset: 0.22, easing: 'cubic-bezier(.18,.65,.27,1)' },
        { transform: 'translateY(0)' },
      ], { duration: 310 })
    }

    const scrollStep = (input: ReaderWheel, distance: number) => {
      // Test the actual movement: rounded scrollHeight/clientHeight can hide
      // the last pixel (or report one that the browser cannot scroll).
      if (input.target === 'article' || (!input.target && point && overArticle(point.x, point.y))) {
        const before = article.scrollTop
        const scale = Number.parseFloat(getComputedStyle(article).zoom) || 1
        article.scrollBy({ top: distance / scale, behavior: 'instant' })
        const moved = (article.scrollTop - before) * scale
        if (moved) {
          input.target = 'article'
          // A wheel may already be finished when its last step is clamped.
          if (input.remaining === distance && Math.abs(distance) - Math.abs(moved) > 0.5) {
            const gap = distance < 0 ? article.scrollTop : article.scrollHeight - article.clientHeight - article.scrollTop
            if (gap <= 1) showEdge(input, distance - moved)
          }
          return true
        }
        if (input.target === 'article') {
          showEdge(input, input.remaining)
          return false
        }
      }
      input.target = 'page'
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
        const input = wheels[0]
        const step = Math.sign(pending) * Math.min(budget, Math.abs(input.remaining))
        const used = scrollStep(input, step) ? step : input.remaining
        pending -= used
        input.remaining -= used
        budget -= Math.abs(step)
        if (!input.remaining) wheels.shift()
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
      if (direction * distance < 0) stop()
      direction = Math.sign(distance)
      fraction += distance
      const pixels = Math.trunc(fraction)
      if (!pixels) return
      fraction -= pixels
      wheels.push({ remaining: pixels, precise: isPreciseWheel(event), target: null })
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
    for (const type of ['pointerdown', 'keydown', 'touchstart', 'resize', 'blur', 'hashchange', pageNavigationScrollEvent]) {
      window.addEventListener(type, stop, { passive: true, signal: events.signal })
    }
    document.addEventListener('visibilitychange', stop, { signal: events.signal })
    motion.addEventListener('change', stop, { signal: events.signal })
    return () => { stop(); events.abort() }
  }, [scrollRef, paused])
}
