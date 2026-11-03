import { useEffect, type RefObject } from 'react'
import { useController } from 'yet-another-react-lightbox'

/** Reveal desktop navigation only while the pointer is near an available arrow. */
export function useGalleryNavigationFeedback(stageRef: RefObject<HTMLDivElement | null>) {
  const { containerRef } = useController()

  useEffect(() => {
    const stage = stageRef.current
    const container = containerRef.current
    if (!stage || !container) return
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
    let mouse: { x: number; y: number } | null = null
    let frame = 0
    const setNavigation = (value: string) => {
      if (container.dataset.galleryNav !== value) container.dataset.galleryNav = value
    }
    const updateNavigation = () => {
      frame = 0
      if (!mouse || !finePointer.matches) { setNavigation(''); return }
      let nearby = ''
      for (const [name, selector] of [['previous', '.yarl__navigation_prev'], ['next', '.yarl__navigation_next']]) {
        const button = container.querySelector<HTMLButtonElement>(selector)
        if (!button || button.disabled) continue
        const bounds = button.getBoundingClientRect()
        if (Math.abs(mouse.x - bounds.x - bounds.width / 2) < 104
          && Math.abs(mouse.y - bounds.y - bounds.height / 2) < 112) nearby = name
      }
      setNavigation(nearby)
    }
    const trackMouse = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      mouse = event.buttons ? null : { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(updateNavigation)
    }
    const leave = () => { mouse = null; setNavigation('') }
    const events = new AbortController()
    container.addEventListener('pointerdown', trackMouse, { capture: true, passive: true, signal: events.signal })
    container.addEventListener('pointermove', trackMouse, { capture: true, passive: true, signal: events.signal })
    container.addEventListener('pointerleave', leave, { signal: events.signal })
    window.addEventListener('pointerup', trackMouse, { capture: true, passive: true, signal: events.signal })
    window.addEventListener('blur', leave, { signal: events.signal })
    window.addEventListener('resize', leave, { signal: events.signal })
    finePointer.addEventListener('change', leave, { signal: events.signal })
    return () => {
      events.abort()
      cancelAnimationFrame(frame)
      delete container.dataset.galleryNav
    }
  }, [containerRef, stageRef])
}
