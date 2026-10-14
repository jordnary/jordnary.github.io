import { useLayoutEffect, type RefObject } from 'react'

export function useFooterReveal(footerRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const footer = footerRef.current
    const surface = footer?.querySelector<HTMLElement>('.footer-surface')
    if (!footer || !surface) return

    let frame = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const revealThreshold = 0.35

    const illuminate = (visible: number, height: number) => {
      if (reducedMotion.matches || footer.dataset.reveal !== 'true') {
        footer.dataset.illuminated = 'true'
      } else if (visible <= 0) {
        footer.dataset.illuminated = 'false'
      } else if (visible / height >= revealThreshold) {
        footer.dataset.illuminated = 'true'
      }
    }

    const update = () => {
      frame = 0
      const { height } = surface.getBoundingClientRect()
      const viewport = document.documentElement.clientHeight
      // Reserve the natural height before fixing the surface beneath the page.
      footer.style.setProperty('--footer-height', `${height}px`)
      // Tall footers retain normal scrolling so every link remains reachable.
      footer.dataset.reveal = String(!reducedMotion.matches && height > 0 && height < viewport)
      const bounds = footer.getBoundingClientRect()
      illuminate(Math.min(viewport, bounds.bottom) - Math.max(0, bounds.top), height)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const revealFocus = () => {
      const bounds = footer.getBoundingClientRect()
      const viewport = document.documentElement.clientHeight
      // Focus can land behind the reveal clip before native scrolling exposes it.
      if (bounds.height < viewport && bounds.bottom > viewport) {
        footer.scrollIntoView({ block: 'end', behavior: 'instant' })
      }
    }
    // Once enough of the underlay is exposed, let it brighten even at rest.
    // Keep it lit on a partial reversal, resetting only after it leaves view.
    const visibility = new IntersectionObserver(([entry]) => {
      illuminate(entry.intersectionRect.height, entry.boundingClientRect.height)
    }, { threshold: [0, revealThreshold] })
    visibility.observe(footer)
    const resize = new ResizeObserver(schedule)
    resize.observe(surface)
    window.addEventListener('resize', schedule)
    reducedMotion.addEventListener('change', update)
    footer.addEventListener('focusin', revealFocus)
    update()

    return () => {
      cancelAnimationFrame(frame)
      visibility.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', schedule)
      reducedMotion.removeEventListener('change', update)
      footer.removeEventListener('focusin', revealFocus)
      delete footer.dataset.reveal
      delete footer.dataset.illuminated
      footer.style.removeProperty('--footer-height')
    }
  }, [footerRef])
}
