import { useEffect, useRef, type RefObject } from 'react'
import { useController, useEventCallback, useLightboxProps, useLightboxState } from 'yet-another-react-lightbox'

export function useGalleryNavigationFeedback(stageRef: RefObject<HTMLDivElement | null>) {
  const { containerRef } = useController()
  const { currentIndex, slides } = useLightboxState()
  const { zoom, carousel, controller } = useLightboxProps()
  const resetRef = useRef<() => void>(() => {})
  const readState = useEventCallback(() => {
    const value = zoom?.ref && typeof zoom.ref !== 'function' ? zoom.ref.current : null
    return { index: currentIndex, count: slides.length, finite: carousel.finite,
      touchNavigation: !controller.disableSwipeNavigation, zoomed: Boolean(value && value.zoom > value.minZoom + 0.01) }
  })

  useEffect(() => {
    const stage = stageRef.current
    const container = containerRef.current
    if (!stage || !container) return
    const lights = [...stage.querySelectorAll<HTMLElement>('.gallery-edge-glow')]
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
    const touches = new Set<number>()
    let gesture: { id: number; x: number; y: number; index: number } | null = null
    let mouse: { x: number; y: number } | null = null
    let frame = 0
    const setNavigation = (value: string) => {
      if (container.dataset.galleryNav !== value) container.dataset.galleryNav = value
    }
    const hideGlow = () => {
      for (const light of lights) {
        light.dataset.active = 'false'
        light.style.setProperty('--edge-strength', '0')
      }
    }
    const reset = () => { gesture = null; hideGlow() }
    resetRef.current = reset
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
      mouse = event.buttons ? null : { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(updateNavigation)
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') { trackMouse(event); return }
      touches.add(event.pointerId)
      reset()
      const state = readState()
      if (touches.size !== 1 || !state.touchNavigation || !state.finite || state.zoomed || state.count < 1) return
      if (!(event.target instanceof Element) || !event.target.closest('.gallery-stage')) return
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, index: state.index }
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') { trackMouse(event); return }
      if (!gesture || event.pointerId !== gesture.id || touches.size !== 1) return
      const state = readState()
      if (state.zoomed || state.index !== gesture.index) { reset(); return }
      const dx = event.clientX - gesture.x
      const dy = event.clientY - gesture.y
      const side = state.index === 0 && dx > 12 ? 'left'
        : state.index === state.count - 1 && dx < -12 ? 'right' : ''
      if (!side || Math.abs(dx) < Math.abs(dy) * 1.25) { hideGlow(); return }
      const strength = 1 - Math.exp(-(Math.abs(dx) - 12) / 90)
      for (const light of lights) {
        const active = light.dataset.side === side
        light.dataset.active = String(active)
        light.style.setProperty('--edge-strength', active ? String(strength) : '0')
      }
    }
    const up = (event: PointerEvent) => {
      touches.delete(event.pointerId)
      if (event.pointerType === 'touch') reset()
      else trackMouse(event)
    }
    const leave = () => { mouse = null; setNavigation('') }
    const blur = () => { leave(); touches.clear(); reset() }
    const events = new AbortController()
    // Observe in capture phase so zoom/pan handlers keep their normal ownership.
    container.addEventListener('pointerdown', down, { capture: true, passive: true, signal: events.signal })
    container.addEventListener('pointermove', move, { capture: true, passive: true, signal: events.signal })
    container.addEventListener('pointerleave', leave, { signal: events.signal })
    window.addEventListener('pointerup', up, { capture: true, passive: true, signal: events.signal })
    window.addEventListener('pointercancel', up, { capture: true, passive: true, signal: events.signal })
    window.addEventListener('blur', blur, { signal: events.signal })
    window.addEventListener('resize', blur, { signal: events.signal })
    finePointer.addEventListener('change', blur, { signal: events.signal })
    return () => {
      events.abort()
      cancelAnimationFrame(frame)
      resetRef.current = () => {}
      delete container.dataset.galleryNav
    }
  }, [containerRef, stageRef, readState])

  useEffect(() => { resetRef.current() }, [currentIndex, slides.length])
}
