import { useCallback, useEffect, useRef, useState } from 'react'
import { notifyNavigationScroll } from './pageScrollSource'

const pinnedQuery = '(min-width: 900px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)'

/** Map native document scrolling to the gallery; never cancel wheel events. */
export function useNoteGallery(count: number) {
  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [canScroll, setCanScroll] = useState(false)
  const metrics = useRef({ pinned: false, distance: 0, top: 0 })

  useEffect(() => {
    const section = sectionRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!section || !viewport || !track) return
    const media = window.matchMedia(pinnedQuery)
    let frame = 0
    let measureFrame = 0

    const update = () => {
      const { pinned, distance, top } = metrics.current
      const start = section.getBoundingClientRect().top + window.scrollY - top
      const offset = pinned ? Math.max(0, Math.min(distance, window.scrollY - start)) : viewport.scrollLeft
      track.style.transform = pinned ? `translate3d(${-offset}px, 0, 0)` : ''
      section.style.setProperty('--notes-progress', String(distance > 0 ? offset / distance : 0))
      const position = distance ? offset / distance * (count - 1) : 0
      setActiveIndex(Math.max(0, Math.min(count - 1, Math.round(position))))
    }

    const measure = () => {
      const distance = Math.max(0, track.scrollWidth - viewport.clientWidth)
      setCanScroll(distance > 0)
      const top = Number.parseFloat(getComputedStyle(section).getPropertyValue('--notes-top')) || 80
      metrics.current = { pinned: media.matches && distance > 0, distance, top }
      section.dataset.pinned = String(metrics.current.pinned)
      section.style.setProperty('--notes-travel', `${metrics.current.pinned ? distance : 0}px`)
      if (metrics.current.pinned) viewport.scrollLeft = 0
      update()
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    const scheduleMeasure = () => { cancelAnimationFrame(measureFrame); measureFrame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(viewport)
    observer.observe(document.body)
    window.addEventListener('scroll', schedule, { passive: true })
    viewport.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    media.addEventListener('change', scheduleMeasure)
    scheduleMeasure()
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(measureFrame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', scheduleMeasure)
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
      notifyNavigationScroll(behavior === 'smooth' && Math.abs(targetTop - window.scrollY) > 1)
      window.scrollTo({ top: targetTop, behavior })
    } else {
      viewport.scrollTo({ left: target, behavior })
    }
  }, [count])

  const reset = () => {
    const section = sectionRef.current
    if (metrics.current.pinned && section && section.getBoundingClientRect().top < metrics.current.top) goTo(0, true)
    viewportRef.current?.scrollTo({ left: 0, behavior: 'instant' })
    setActiveIndex(0)
  }

  return { sectionRef, viewportRef, trackRef, activeIndex, canScroll, goTo, reset }
}
