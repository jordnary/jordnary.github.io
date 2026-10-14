import { useCallback, useEffect, useRef, useState } from 'react'
import { notifyNavigationScroll } from './pageScrollSource'

const pinnedQuery = '(min-width: 900px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)'
const followTimeMs = 90
const settleDistance = 0.25

/** Map native document scrolling to the gallery; never cancel wheel events. */
export function useNoteGallery(count: number) {
  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [canScroll, setCanScroll] = useState(false)
  const metrics = useRef({ pinned: false, distance: 0, top: 0, start: 0 })
  const syncRef = useRef<(instant?: boolean) => void>(() => {})
  const nativeScrollTarget = useRef<number | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    const progress = progressRef.current
    if (!section || !viewport || !track) return
    const media = window.matchMedia(pinnedQuery)
    let frame = 0
    let measureFrame = 0
    let renderedOffset = 0
    let targetOffset = 0
    let lastTime = 0
    let displayedIndex = -1

    const paint = (offset: number) => {
      const { pinned, distance } = metrics.current
      track.style.transform = pinned ? `translate3d(${-offset}px, 0, 0)` : ''
      if (progress) progress.style.transform = `scaleX(${distance > 0 ? offset / distance : 0})`
      const position = distance ? offset / distance * (count - 1) : 0
      const index = Math.max(0, Math.min(count - 1, Math.round(position)))
      if (index !== displayedIndex) {
        displayedIndex = index
        setActiveIndex(index)
      }
    }

    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    const animate = (time: number) => {
      frame = 0
      const elapsed = Math.min(64, Math.max(0, time - lastTime))
      lastTime = time
      renderedOffset += (targetOffset - renderedOffset) * (1 - Math.exp(-elapsed / followTimeMs))
      if (Math.abs(targetOffset - renderedOffset) < settleDistance) renderedOffset = targetOffset
      paint(renderedOffset)
      if (renderedOffset !== targetOffset) frame = requestAnimationFrame(animate)
    }

    const sync = (instant = false) => {
      const { pinned, distance, start } = metrics.current
      targetOffset = Math.max(0, Math.min(distance, pinned ? window.scrollY - start : viewport.scrollLeft))
      const nativeTarget = nativeScrollTarget.current
      const nativeNavigation = nativeTarget !== null
      if (nativeTarget !== null && Math.abs(window.scrollY - nativeTarget) < 1) nativeScrollTarget.current = null
      // Snap outside the sticky range, and follow already-smooth navigation without a second easing.
      if (instant || !pinned || targetOffset === 0 || targetOffset === distance || nativeNavigation || document.hidden) {
        stop()
        renderedOffset = targetOffset
        paint(renderedOffset)
      } else if (!frame && renderedOffset !== targetOffset) {
        lastTime = performance.now()
        frame = requestAnimationFrame(animate)
      }
    }
    syncRef.current = sync

    const measure = () => {
      const distance = Math.max(0, track.scrollWidth - viewport.clientWidth)
      setCanScroll(distance > 0)
      const top = Number.parseFloat(getComputedStyle(section).getPropertyValue('--notes-top')) || 80
      const start = section.getBoundingClientRect().top + window.scrollY - top
      if (Math.abs(start - metrics.current.start) > 1 || distance !== metrics.current.distance) nativeScrollTarget.current = null
      metrics.current = { pinned: media.matches && distance > 0, distance, top, start }
      section.dataset.pinned = String(metrics.current.pinned)
      section.style.setProperty('--notes-travel', `${metrics.current.pinned ? distance : 0}px`)
      if (metrics.current.pinned) viewport.scrollLeft = 0
      if (!metrics.current.pinned) nativeScrollTarget.current = null
      sync(true)
    }
    const schedule = () => sync()
    const scheduleMeasure = () => { cancelAnimationFrame(measureFrame); measureFrame = requestAnimationFrame(measure) }
    const cancelNavigation = () => { nativeScrollTarget.current = null }
    const onVisibilityChange = () => sync(true)
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(viewport)
    observer.observe(document.body)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scrollend', cancelNavigation, { passive: true })
    viewport.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, cancelNavigation, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    media.addEventListener('change', scheduleMeasure)
    scheduleMeasure()
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(measureFrame)
      syncRef.current = () => {}
      nativeScrollTarget.current = null
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('scrollend', cancelNavigation)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', scheduleMeasure)
      for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(type, cancelNavigation)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      media.removeEventListener('change', scheduleMeasure)
    }
  }, [count])

  const goTo = useCallback((index: number, instant = false) => {
    const section = sectionRef.current
    const viewport = viewportRef.current
    if (!section || !viewport) return
    const { pinned, distance, top } = metrics.current
    const targetIndex = Math.max(0, Math.min(count - 1, index))
    const target = targetIndex / Math.max(1, count - 1) * distance
    const behavior = instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    if (pinned) {
      const targetTop = section.getBoundingClientRect().top + window.scrollY - top + target
      nativeScrollTarget.current = behavior === 'smooth' ? targetTop : null
      notifyNavigationScroll(behavior === 'smooth' && Math.abs(targetTop - window.scrollY) > 1)
      window.scrollTo({ top: targetTop, behavior })
      syncRef.current(true)
    } else {
      viewport.scrollTo({ left: target, behavior })
      if (behavior === 'instant') syncRef.current(true)
    }
  }, [count])

  const reset = () => {
    const section = sectionRef.current
    if (metrics.current.pinned && section && section.getBoundingClientRect().top < metrics.current.top) goTo(0, true)
    viewportRef.current?.scrollTo({ left: 0, behavior: 'instant' })
    syncRef.current(true)
    setActiveIndex(0)
  }

  return { sectionRef, viewportRef, trackRef, progressRef, activeIndex, canScroll, goTo, reset }
}
