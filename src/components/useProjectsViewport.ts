import { useLayoutEffect, type RefObject } from 'react'

/** Keep the decorative background beyond the visible area, with text inside it. */
export function useProjectsViewport(archiveRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const archive = archiveRef.current
    const viewport = window.visualViewport
    if (!archive || !viewport) return

    const update = () => {
      // Zooming must keep native panning available instead of masking magnified text.
      if (viewport.scale !== 1) {
        archive.style.removeProperty('--archive-viewport-bottom')
        return
      }
      archive.style.setProperty('--archive-viewport-bottom', `${viewport.offsetTop + viewport.height}px`)
    }
    update()
    viewport.addEventListener('resize', update, { passive: true })
    viewport.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('pageshow', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('pageshow', update)
      archive.style.removeProperty('--archive-viewport-bottom')
    }
  }, [archiveRef])
}
