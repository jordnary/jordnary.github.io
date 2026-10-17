import { useLayoutEffect, type RefObject } from 'react'

export function useHomeSectionParallax(rootRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sections = Array.from(root.querySelectorAll<HTMLElement>('.home-editorial-section')).map(section => ({
      section,
      heading: section.querySelector<HTMLElement>('.home-editorial-section-heading'),
      cards: section.querySelector<HTMLElement>('.home-editorial-feature-layout, .home-editorial-journal-rail'),
    }))
    const properties = ['--home-section-heading-travel', '--home-section-cards-travel'] as const
    let frame = 0
    let disposed = false

    const reset = () => {
      sections.forEach(({ section }) => properties.forEach(property => section.style.removeProperty(property)))
    }

    const update = () => {
      frame = 0
      if (disposed || document.hidden || reducedMotion.matches) return
      const midpoint = window.innerHeight / 2
      // Read stationary layout anchors before writing any translated child styles.
      // Absolute scroll positions make forward/backward scrolling retrace exactly.
      const positions = sections.map(({ section, heading, cards }) => ({
        section,
        travel: [heading, cards].map(anchor => anchor ? midpoint - anchor.getBoundingClientRect().top : 0),
      }))
      positions.forEach(({ section, travel }) => properties.forEach((property, index) => {
        section.style.setProperty(property, `${travel[index].toFixed(2)}px`)
      }))
    }

    const schedule = () => {
      if (!disposed && !frame && !document.hidden && !reducedMotion.matches) frame = window.requestAnimationFrame(update)
    }

    const syncMotion = () => {
      window.cancelAnimationFrame(frame)
      frame = 0
      if (reducedMotion.matches) reset()
      else schedule()
    }

    // Translations do not affect these boxes, so layout changes cannot feed back.
    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(root)
    sections.forEach(({ heading, cards }) => {
      if (heading) resizeObserver.observe(heading)
      if (cards) resizeObserver.observe(cards)
    })
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    document.addEventListener('visibilitychange', syncMotion)
    reducedMotion.addEventListener('change', syncMotion)
    void document.fonts.ready.then(schedule)
    update()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', syncMotion)
      reducedMotion.removeEventListener('change', syncMotion)
      reset()
    }
  }, [rootRef])
}
