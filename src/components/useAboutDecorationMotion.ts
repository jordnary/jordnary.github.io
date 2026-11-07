import { useEffect, useRef } from 'react'

/** The page owns one observer for its decorative CSS animations. Observe the fixed
 * artwork bounds so moving SVG paths cannot pause their own clock. */
export function useAboutDecorationMotion() {
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const targets = rootRef.current?.querySelectorAll<HTMLElement | SVGElement>('[data-motion-threshold]')
    if (!targets?.length) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const observer = new IntersectionObserver(entries => {
      if (document.hidden || reduced.matches) return
      for (const entry of entries) {
        const target = entry.target as HTMLElement | SVGElement
        const running = entry.isIntersecting && entry.intersectionRatio >= Number(target.dataset.motionThreshold ?? 0)
        target.dataset.motion = running ? 'running' : 'paused'
      }
    }, { threshold: [0, 0.15] })
    const sync = () => {
      observer.disconnect()
      for (const target of targets) {
        target.dataset.motion = 'paused'
        if (!document.hidden && !reduced.matches) observer.observe(target)
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    reduced.addEventListener('change', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      reduced.removeEventListener('change', sync)
    }
  }, [])
  return rootRef
}
