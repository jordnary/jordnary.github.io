import { useLayoutEffect, type RefObject } from 'react'

const followTimes = [65, 160]
const positionTolerance = .02
// Measured against the reference: the visible path slows gently, and reaches
// its endpoint only after the heading has left the viewport.
const headingEntry = 1
const headingExit = -.55
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function useHomeSectionParallax(rootRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sections = Array.from(root.querySelectorAll<HTMLElement>('.home-editorial-section')).map(section => ({
      section,
      heading: section.querySelector<HTMLElement>('.home-editorial-section-heading h2'),
      cards: section.querySelector<HTMLElement>('.home-gallery'),
      cardContents: Array.from(section.querySelectorAll<HTMLElement>('.home-gallery-card-content')),
      gallery: Boolean(section.querySelector('.home-gallery')),
      documentTops: [0, 0],
      current: [0, 0],
      target: [0, 0],
      written: ['', ''],
    }))
    let frame = 0
    let lastTime = 0
    let layoutDirty = true
    let targetsDirty = true
    let snapToPosition = true
    let viewportHeight = 0
    let headingStart = 0
    let headingEnd = 0
    let photoLimit = 0
    let disposed = false

    const reset = () => {
      sections.forEach(state => {
        state.section.style.removeProperty('--home-section-photo-limit')
        state.heading?.style.removeProperty('translate')
        state.cardContents.forEach(node => node.style.removeProperty('translate'))
        state.written = ['', '']
      })
    }

    const update = (time: number) => {
      frame = 0
      if (disposed || document.hidden || reducedMotion.matches) return
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 1000 / 60
      lastTime = time

      if (layoutDirty) {
        const { innerWidth: width, innerHeight: height } = window
        const scrollTop = window.scrollY
        viewportHeight = height
        headingStart = width <= 600 ? -10 : -Math.min(width * .026, 80)
        headingEnd = width <= 600 ? 10 : Math.min(width * .036, 112)
        photoLimit = width <= 600 ? Math.min(width * .03, 12) : width <= 900 ? width * .04 : Math.min(width * .07, 140)
        // Cache document-space anchors only when layout changes. Normal scrolling
        // reads scrollY, avoiding synchronous layout work on every animation frame.
        sections.forEach(state => {
          state.documentTops = [state.heading, state.cards].map(node => (node?.getBoundingClientRect().top ?? height) + scrollTop)
        })
        sections.forEach(state => {
          state.section.style.setProperty('--home-section-photo-limit', `${photoLimit}px`)
          state.current = [clamp(state.current[0], headingStart, headingEnd), clamp(state.current[1], -photoLimit, photoLimit)]
        })
        layoutDirty = false
        targetsDirty = true
      }

      if (targetsDirty) {
        const scrollTop = window.scrollY
        // Keep most of the visible path evenly paced, then taper gently through
        // the upper edge. Photos use a separate, near-linear counter-motion.
        sections.forEach(state => {
          const [headingTop, cardsTop] = state.documentTops.map(top => top - scrollTop)
          const progress = clamp((viewportHeight * headingEntry - headingTop) / (viewportHeight * (headingEntry - headingExit)), 0, 1)
          const eased = progress * (2 - progress)
          // The gallery drifts left as it rises, reversing along the same path
          // when scrolling back. Its native drag positions remain stationary.
          const photoTarget = state.gallery
            ? (cardsTop - viewportHeight * .4) * .175
            : (cardsTop - viewportHeight / 2) * .2
          state.target = [state.heading ? headingStart + eased * (headingEnd - headingStart) : 0, clamp(photoTarget, -photoLimit, photoLimit)]
          if (snapToPosition) state.current = [...state.target]
        })
        targetsDirty = false
        snapToPosition = false
      }

      let moving = false
      sections.forEach(state => state.target.forEach((target, index) => {
        const difference = target - state.current[index]
        if (Math.abs(difference) <= positionTolerance) state.current[index] = state.target[index]
        else {
          const weight = 1 - Math.exp(-elapsed / followTimes[index])
          state.current[index] += difference * weight
          moving = true
        }
        const translation = `${state.current[index].toFixed(3)}px 0px`
        if (translation !== state.written[index]) {
          // Write compositor translations directly to the moving elements instead
          // of invalidating inherited custom properties throughout each section.
          const nodes = index === 0 ? [state.heading] : state.cardContents
          nodes.forEach(node => { if (node) node.style.translate = translation })
          state.written[index] = translation
        }
      }))
      if (moving) frame = window.requestAnimationFrame(update)
      else lastTime = 0
    }

    const schedule = () => {
      if (disposed || document.hidden || reducedMotion.matches) return
      targetsDirty = true
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    const refreshLayout = () => {
      layoutDirty = true
      schedule()
    }

    const syncMotion = () => {
      window.cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      if (reducedMotion.matches) reset()
      else {
        snapToPosition = true
        refreshLayout()
      }
    }

    // Translations do not affect these boxes, so layout changes cannot feed back.
    const resizeObserver = new ResizeObserver(refreshLayout)
    resizeObserver.observe(root)
    sections.forEach(({ heading, cards }) => {
      if (heading) resizeObserver.observe(heading)
      if (cards) resizeObserver.observe(cards)
    })
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', refreshLayout, { passive: true })
    document.addEventListener('visibilitychange', syncMotion)
    reducedMotion.addEventListener('change', syncMotion)
    void document.fonts.ready.then(refreshLayout)
    update(performance.now())

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', refreshLayout)
      document.removeEventListener('visibilitychange', syncMotion)
      reducedMotion.removeEventListener('change', syncMotion)
      reset()
    }
  }, [rootRef])
}
