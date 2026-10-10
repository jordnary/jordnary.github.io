import { useId, useLayoutEffect, useRef, type RefObject } from 'react'
import { createChapterMotion } from './aboutJourneyMotion'

// Approximate one wheel notch in document space; keep the boundary stable for
// wheel, keyboard, and trackpad scrolling rather than tying it to event deltas.
const exitScrollGap = 120
const exitDelay = 300

/** Keep a regular S curve and place chapters along it, never bend the curve around cards. */
export function AboutJourneyPath({ containerRef }: { containerRef: RefObject<HTMLOListElement | null> }) {
  const pathId = useId()
  const progressRef = useRef<SVGPathElement>(null)
  const endingRef = useRef<SVGPathElement>(null)
  const solidClipRef = useRef<SVGRectElement>(null)
  const endingClipRef = useRef<SVGRectElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const progress = progressRef.current
    const ending = endingRef.current
    const solidClip = solidClipRef.current
    const endingClip = endingClipRef.current
    if (!container || !progress || !ending || !solidClip || !endingClip) return

    const chapters = Array.from(container.querySelectorAll<HTMLElement>('.journey-chapter'))
    const nodes = Array.from(container.querySelectorAll<HTMLElement>('.journey-node'))
    const motion = chapters.map(createChapterMotion)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compactLayout = window.matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)')
    let animated = !compactLayout.matches && !reducedMotion.matches
    let samples: { y: number; length: number }[] = []
    let length = 0
    let tailStart = 0
    let frame = 0
    let needsMeasure = true
    let disposed = false
    let previousScrollY = Math.max(0, window.scrollY)
    let scrollDirection: 'up' | 'down' = 'down'
    let motionInitialized = false

    const distanceAtY = (y: number) => {
      let low = 0
      let high = samples.length - 1
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2)
        if (samples[middle].y < y) low = middle
        else high = middle
      }
      const before = samples[low]
      const after = samples[high]
      const ratio = Math.max(0, Math.min(1, (y - before.y) / (after.y - before.y || 1)))
      return before.length + (after.length - before.length) * ratio
    }

    const measure = () => {
      const compact = compactLayout.matches
      chapters.forEach(chapter => {
        if (compact) {
          chapter.style.removeProperty('--chapter-offset')
          chapter.style.removeProperty('--node-offset')
        }
      })
      const bounds = container.getBoundingClientRect()
      const chapterBounds = chapters.map(chapter => chapter.getBoundingClientRect())
      const center = bounds.width / 2
      const amplitude = bounds.width * 0.4
      // Fewer bends than cards let adjacent chapters share a sweep, instead of
      // forming two columns at the extrema. All full bends use the same geometry.
      const turns = Math.max(2, Math.ceil(chapters.length / 2) - 1)
      const step = (bounds.height - 24) / (turns + 1)
      let peak = { x: center + amplitude, y: 12 + step / 2 }
      let d = `M ${center} 12 C ${center + amplitude / 2} ${12 + step / 8}, ${peak.x} ${12 + step / 4}, ${peak.x} ${peak.y}`
      for (let index = 1; index <= turns; index++) {
        const next = { x: center + amplitude * (index % 2 ? -1 : 1), y: peak.y + step }
        d += ` C ${peak.x} ${peak.y + step / 2}, ${next.x} ${next.y - step / 2}, ${next.x} ${next.y}`
        peak = next
      }
      const endY = bounds.height - 12
      d += ` C ${peak.x} ${endY - step / 4}, ${(peak.x + center) / 2} ${endY - step / 8}, ${center} ${endY}`
      if (compact) {
        const rect = nodes[0].getBoundingClientRect()
        d = `M ${rect.left + rect.width / 2 - bounds.left} 12 V ${endY}`
      }
      progress.setAttribute('d', d)
      ending.setAttribute('d', d)
      length = progress.getTotalLength()
      progress.style.strokeDasharray = `${length}`
      // Cache vertical positions so scrolling only updates the revealed length.
      samples = Array.from({ length: 241 }, (_, index) => {
        const distance = length * index / 240
        return { y: progress.getPointAtLength(distance).y, length: distance }
      })
      // Only the continuation after the final node is dashed. Clipping it by
      // the reading position keeps unreached dashes invisible as well.
      tailStart = compact ? bounds.height : chapterBounds[chapterBounds.length - 1].bottom - bounds.top + 14
      solidClip.setAttribute('height', `${tailStart + 4}`)
      endingClip.setAttribute('y', `${tailStart}`)
      ending.style.strokeDashoffset = `${-distanceAtY(tailStart)}`
      chapterBounds.forEach((rect, index) => {
        const y = rect.bottom - bounds.top + 14
        const point = progress.getPointAtLength(distanceAtY(y))
        if (!compact) {
          const cardLeft = point.x < center ? point.x + 28 : point.x - rect.width - 28
          chapters[index].style.setProperty('--chapter-offset', `${cardLeft}px`)
          chapters[index].style.setProperty('--node-offset', `${point.x - cardLeft}px`)
        }
      })
    }

    const paint = () => {
      frame = 0
      if (needsMeasure) { measure(); needsMeasure = false }
      if (!length) return
      const containerTop = container.getBoundingClientRect().top
      const viewportHeight = window.innerHeight
      const scrollY = Math.max(0, window.scrollY)
      if (scrollY !== previousScrollY) scrollDirection = scrollY < previousScrollY ? 'up' : 'down'
      previousScrollY = scrollY
      const readingY = viewportHeight * 0.86 - containerTop
      const chapterBounds = chapters.map(chapter => chapter.getBoundingClientRect())
      const nodeBounds = nodes.map(node => node.getBoundingClientRect())
      chapters.forEach((chapter, index) => {
        const rect = chapterBounds[index]
        // The node's leading edge entering the viewport is the only reveal anchor.
        // Scrolling one notch back above that document position moves it 120px
        // below the viewport, without depending on card height or animation pose.
        const hasRoom = nodeBounds[index].top <= viewportHeight
        const pastExit = nodeBounds[index].top >= viewportHeight + exitScrollGap
        const visible = chapter.dataset.reached === 'true'
        if (!animated || scrollDirection !== 'up' || !pastExit) motion[index].cancelExit()
        if (!animated) {
          motion[index].reveal(true, false)
        } else if (scrollDirection === 'up') {
          // Hold the current pose briefly after crossing the earlier scroll
          // position. Reversing direction cancels the pending exit above.
          if (pastExit) motion[index].deferExit(exitDelay)
          else if (!visible && hasRoom) motion[index].reveal(true, false)
        } else if (rect.bottom <= 0) {
          // A fast downward jump may skip a card; settle it before a later return.
          motion[index].reveal(true, false)
        } else if (hasRoom) {
          motion[index].reveal(true)
        }
      })
      const distance = animated ? distanceAtY(readingY) : length
      progress.style.strokeDashoffset = `${length - distance}`
      progress.style.opacity = distance > 0 ? '1' : '0'
      endingClip.setAttribute('height', `${Math.max(0, (animated ? readingY : container.offsetHeight) - tailStart)}`)
    }

    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(paint) }
    const resize = () => { needsMeasure = true; schedule() }
    const syncMotionMode = () => {
      const nextAnimated = !compactLayout.matches && !reducedMotion.matches
      if (motionInitialized && animated === nextAnimated) { resize(); return }
      animated = nextAnimated
      previousScrollY = Math.max(0, window.scrollY)
      container.dataset.motion = animated ? 'animated' : 'static'
      motion.forEach((controller, index) => {
        // Switching back from a static layout must not replay visible or earlier cards.
        const alreadyInView = motionInitialized && nodes[index].getBoundingClientRect().top <= window.innerHeight
        controller.reset(!animated || alreadyInView)
      })
      motionInitialized = true
      window.removeEventListener('scroll', schedule)
      if (animated) window.addEventListener('scroll', schedule, { passive: true })
      resize()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    chapters.forEach(chapter => observer.observe(chapter))

    window.addEventListener('resize', resize)
    reducedMotion.addEventListener('change', syncMotionMode)
    compactLayout.addEventListener('change', syncMotionMode)
    document.fonts.ready.then(() => { if (!disposed) resize() })
    syncMotionMode()
    // Establish a real starting pose before paint; restored positions also animate.
    window.cancelAnimationFrame(frame)
    paint()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      motion.forEach(controller => controller.dispose())
      chapters.forEach(chapter => {
        chapter.style.removeProperty('--chapter-offset')
        chapter.style.removeProperty('--node-offset')
      })
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', resize)
      reducedMotion.removeEventListener('change', syncMotionMode)
      compactLayout.removeEventListener('change', syncMotionMode)
      delete container.dataset.motion
    }
  }, [containerRef])

  return (
    <svg className="journey-path" aria-hidden="true" focusable="false" fill="none">
      <defs>
        <clipPath id={`${pathId}-solid`}><rect ref={solidClipRef} x="-4" y="-4" width="100%" height="0" /></clipPath>
        <clipPath id={`${pathId}-ending`}><rect ref={endingClipRef} x="-4" width="100%" height="0" /></clipPath>
      </defs>
      <path className="journey-path-progress" ref={progressRef} clipPath={`url(#${pathId}-solid)`} />
      <path className="journey-path-ending" ref={endingRef} clipPath={`url(#${pathId}-ending)`} />
    </svg>
  )
}
