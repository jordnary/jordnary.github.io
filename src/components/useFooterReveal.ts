import { useLayoutEffect, type RefObject } from 'react'

export function useFooterReveal(footerRef: RefObject<HTMLElement | null>, paperSeam: boolean) {
  // Navigation must reserve the new padding before paint, even while the footer is offscreen.
  useLayoutEffect(() => {
    const footer = footerRef.current
    const surface = footer?.querySelector<HTMLElement>('.footer-surface')
    if (!footer || !surface) return

    let frame = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(pointer: coarse)')

    const update = () => {
      frame = 0
      const { height } = surface.getBoundingClientRect()
      const viewport = document.documentElement.clientHeight
      // Reserve the natural height before fixing the surface beneath the page.
      footer.style.setProperty('--footer-height', `${height}px`)
      // Touch pages scroll inside a stationary frame. A fixed blue surface at its
      // lower edge can leave Safari's toolbar tinted even after scrolling away.
      // Tall footers also retain normal scrolling so every link remains reachable.
      footer.dataset.reveal = String(!coarsePointer.matches && !reducedMotion.matches && height > 0 && height < viewport)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const revealFocus = () => {
      if (footer.dataset.reveal !== 'true') return
      const bounds = footer.getBoundingClientRect()
      const viewport = document.documentElement.clientHeight
      // Focus can land behind the reveal clip before native scrolling exposes it.
      if (bounds.height < viewport && bounds.bottom > viewport) {
        footer.scrollIntoView({ block: 'end', behavior: 'instant' })
      }
    }
    const resize = new ResizeObserver(schedule)
    // Route changes can change only the paper padding, leaving the content box unchanged.
    resize.observe(surface, { box: 'border-box' })
    window.addEventListener('resize', schedule)
    reducedMotion.addEventListener('change', update)
    coarsePointer.addEventListener('change', update)
    footer.addEventListener('focusin', revealFocus)
    update()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('resize', schedule)
      reducedMotion.removeEventListener('change', update)
      coarsePointer.removeEventListener('change', update)
      footer.removeEventListener('focusin', revealFocus)
      delete footer.dataset.reveal
      footer.style.removeProperty('--footer-height')
    }
  }, [footerRef, paperSeam])
}
