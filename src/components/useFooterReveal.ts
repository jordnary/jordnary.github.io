import { useLayoutEffect, type RefObject } from 'react'
import { getPageViewportHeight } from '../lib/pageScrollSource'

export function useFooterReveal(footerRef: RefObject<HTMLElement | null>, paperSeam: boolean) {
  // Navigation must reserve the new padding before paint, even while the footer is offscreen.
  useLayoutEffect(() => {
    const footer = footerRef.current
    const surface = footer?.querySelector<HTMLElement>('.footer-surface')
    if (!footer || !surface) return

    let frame = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(pointer: coarse)')
    const scrollFrame = footer.closest('#site-scroll')
    let nearFooter = false

    const update = () => {
      frame = 0
      const { height } = surface.getBoundingClientRect()
      const viewport = getPageViewportHeight()
      // Reserve the natural height before fixing the surface beneath the page.
      footer.style.setProperty('--footer-height', `${height}px`)
      // Release the fixed blue surface away from the mobile page end so it
      // cannot tint the browser toolbar after the footer has scrolled away.
      const canReveal = !reducedMotion.matches && height > 0 && height < viewport
      footer.dataset.reveal = String(canReveal && (!coarsePointer.matches || nearFooter))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const revealFocus = () => {
      if (footer.dataset.reveal !== 'true') return
      const bounds = footer.getBoundingClientRect()
      const viewport = getPageViewportHeight()
      // Focus can land behind the reveal clip before native scrolling exposes it.
      if (bounds.height < viewport && bounds.bottom > viewport) {
        footer.scrollIntoView({ block: 'end', behavior: 'instant' })
      }
    }
    const resize = new ResizeObserver(schedule)
    // Route changes can change only the paper padding, leaving the content box unchanged.
    resize.observe(surface, { box: 'border-box' })
    // The stationary frame can resize independently of the browser window.
    if (scrollFrame) resize.observe(scrollFrame)
    const proximity = new IntersectionObserver(([entry]) => {
      nearFooter = entry.isIntersecting
      if (coarsePointer.matches) schedule()
    }, { root: scrollFrame, rootMargin: '160px 0px' })
    proximity.observe(footer)
    window.addEventListener('resize', schedule)
    reducedMotion.addEventListener('change', update)
    coarsePointer.addEventListener('change', update)
    footer.addEventListener('focusin', revealFocus)
    update()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      proximity.disconnect()
      window.removeEventListener('resize', schedule)
      reducedMotion.removeEventListener('change', update)
      coarsePointer.removeEventListener('change', update)
      footer.removeEventListener('focusin', revealFocus)
      delete footer.dataset.reveal
      footer.style.removeProperty('--footer-height')
    }
  }, [footerRef, paperSeam])
}
