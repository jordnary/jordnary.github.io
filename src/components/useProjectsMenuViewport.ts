import { useLayoutEffect, type RefObject } from 'react'

/** Smooth the mobile browser's stepped visual-viewport updates on the compositor. */
export function useProjectsMenuViewport(buttonRef: RefObject<HTMLButtonElement | null>) {
  useLayoutEffect(() => {
    const button = buttonRef.current
    const viewport = window.visualViewport
    if (!button || !viewport) return
    const touch = matchMedia('(pointer: coarse)')
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let position = 0
    let target = 0
    let width = window.innerWidth
    let frame = 0
    let previousTime = 0
    let dirty = false
    let active = false
    let controlHeight = 0
    let safeTop = 4
    let safeBottom = 4
    const measure = () => {
      const style = getComputedStyle(button)
      const inset = Number.parseFloat(style.bottom) || 24
      controlHeight = button.getBoundingClientRect().height
      safeTop = Math.max(4, Number.parseFloat(style.getPropertyValue('--menu-safe-top')) || 0)
      safeBottom = Math.max(4, Number.parseFloat(style.getPropertyValue('--menu-safe-bottom')) || 0)
      return Math.max(viewport.offsetTop + safeTop, viewport.offsetTop + viewport.height - inset - controlHeight)
    }
    const contain = () => {
      const top = viewport.offsetTop + safeTop
      const bottom = Math.max(top, viewport.offsetTop + viewport.height - controlHeight - safeBottom)
      position = Math.max(top, Math.min(bottom, position))
    }
    const paint = () => button.style.setProperty('--menu-viewport-y', `${position}px`)
    const cancel = () => { cancelAnimationFrame(frame); frame = 0; previousTime = 0 }
    const draw = (time: number) => {
      frame = 0
      if (!active) return
      if (dirty) {
        target = measure()
        dirty = false
      }
      const rotated = width !== window.innerWidth
      width = window.innerWidth
      const elapsed = previousTime ? Math.min(time - previousTime, 48) : 1000 / 60
      previousTime = time
      if (rotated || reducedMotion.matches || document.hidden || Math.abs(target - position) > viewport.height / 3) position = target
      else position += (target - position) * (1 - Math.exp(-elapsed / 60))
      contain()
      if (Math.abs(target - position) < .01) position = target
      paint()
      if (position !== target) frame = requestAnimationFrame(draw)
      else previousTime = 0
    }
    const update = () => {
      if (!active) return
      dirty = true
      // Containment must happen before the next paint when browser chrome
      // suddenly reduces the visible area; smoothing then restores the inset.
      contain()
      paint()
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const sync = () => {
      cancel()
      active = touch.matches
      if (!active) {
        delete button.dataset.viewportAnchor
        button.style.removeProperty('--menu-viewport-y')
        return
      }
      position = target = measure()
      width = window.innerWidth
      paint()
      button.dataset.viewportAnchor = 'true'
    }
    sync()
    const resize = new ResizeObserver(update)
    resize.observe(button)
    viewport.addEventListener('resize', update, { passive: true })
    viewport.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    document.addEventListener('visibilitychange', sync)
    touch.addEventListener('change', sync)
    reducedMotion.addEventListener('change', sync)
    return () => {
      cancel()
      resize.disconnect()
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('visibilitychange', sync)
      touch.removeEventListener('change', sync)
      reducedMotion.removeEventListener('change', sync)
      delete button.dataset.viewportAnchor
      button.style.removeProperty('--menu-viewport-y')
    }
  }, [buttonRef])
}
