import { useEffect, type RefObject } from 'react'
import { pageNavigationScrollEvent } from './pageScrollSource'

/** Route wheel motion by the current pointer position, including during a gesture. */
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
    let point: { x: number; y: number } | null = null
    let controlledWheel: WheelEvent | null = null
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      pending = 0
    }

    const consume = (distance: number) => {
      if (!point) return 0
      // Read the current hit and geometry once per frame, before scrolling.
      // Wheel targets can remain latched to where a native gesture started.
      const hovered = article.contains(document.elementFromPoint(point.x, point.y))
      const bounds = article.getBoundingClientRect()
      const scale = Number.parseFloat(getComputedStyle(article).zoom) || 1
      let remaining = distance
      let consumed = 0
      if (hovered) {
        const before = article.scrollTop
        article.scrollBy({ top: distance / scale, behavior: 'instant' })
        consumed = (article.scrollTop - before) * scale
        remaining -= consumed
      }
      if (remaining * distance <= 0) return consumed

      // Stop at the point where page motion brings the article under the
      // pointer. The next frame consumes the rest using the new hovered region.
      if (!hovered && point.x >= bounds.left && point.x < bounds.right) {
        if (remaining > 0 && point.y < bounds.top) {
          remaining = Math.min(remaining, Math.ceil(bounds.top - point.y))
        } else if (remaining < 0 && point.y >= bounds.bottom) {
          remaining = Math.max(remaining, -Math.floor(point.y - bounds.bottom) - 1)
        }
      }
      const before = window.scrollY
      window.scrollBy({ top: remaining, behavior: 'instant' })
      return consumed + window.scrollY - before
    }

    const advance = (time: number) => {
      frame = 0
      const available = Math.trunc(pending)
      if (!available) { previousTime = 0; return }
      const elapsed = previousTime ? Math.min(48, time - previousTime) : 16
      previousTime = time
      const distance = motion.matches ? available : Math.sign(available)
        * Math.min(Math.abs(available), Math.max(1, Math.floor(Math.abs(pending) * (1 - Math.exp(-elapsed / 70)))))
      const consumed = consume(distance)
      pending -= consumed
      if (!consumed) { stop(); return }
      if (Math.abs(pending) >= 1) frame = requestAnimationFrame(advance)
      else previousTime = 0
    }

    const wheel = (event: WheelEvent) => {
      if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey
        || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { stop(); return }
      // Cancel from the first wheel so the browser cannot lock a continuous
      // gesture to the old scroll container. Touch and keyboard remain native.
      event.preventDefault()
      controlledWheel = event
      point = { x: event.clientX, y: event.clientY }
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? Number.parseFloat(getComputedStyle(article).lineHeight) || 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1
      const distance = event.deltaY * unit
      if (pending * distance < 0) stop()
      pending += distance
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
    // Pointer movement only records coordinates; it never measures or scrolls.
    window.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch') point = { x: event.clientX, y: event.clientY }
    }, { passive: true, signal: events.signal })
    for (const type of ['pointerdown', 'keydown', 'touchstart', 'resize', 'blur', pageNavigationScrollEvent]) {
      window.addEventListener(type, stop, { passive: true, signal: events.signal })
    }
    document.addEventListener('visibilitychange', stop, { signal: events.signal })
    motion.addEventListener('change', stop, { signal: events.signal })
    return () => { stop(); events.abort() }
  }, [scrollRef, paused])
}
