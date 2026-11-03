import { createContext, useContext, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useEventCallback, useLightboxProps, useLightboxState, useMotionPreference } from 'yet-another-react-lightbox'

const SLOP = 8
const RESISTANCE = 0.5
const RETURN_RATE = 20
export const GALLERY_DOUBLE_TAP_DELAY = 300

export const GalleryEdgeContext = createContext<Dispatch<SetStateAction<boolean>> | null>(null)

type Gesture = {
  id: number
  x: number
  y: number
  index: number
  direction: 1 | -1
  phase: 'pending' | 'edge'
}

/** A bounded pull and its edge light share one displacement and one frame clock. */
export function useGalleryEdgeFeedback(stageRef: RefObject<HTMLDivElement | null>) {
  const setEdgePulling = useContext(GalleryEdgeContext)
  const { currentIndex, slides } = useLightboxState()
  const { carousel, controller, zoom } = useLightboxProps()
  const reducedMotion = useMotionPreference()
  const resetRef = useRef<() => void>(() => {})
  const enabled = carousel.finite && !controller.disableSwipeNavigation && slides.length > 1
  const readState = useEventCallback(() => {
    const value = zoom?.ref && typeof zoom.ref !== 'function' ? zoom.ref.current : null
    return { index: currentIndex, count: slides.length, reducedMotion,
      zoomed: Boolean(value && value.zoom > value.minZoom + 0.01) }
  })

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !enabled) return
    const left = stage.querySelector<HTMLElement>('.gallery-edge-glow[data-side="left"]')
    const right = stage.querySelector<HTMLElement>('.gallery-edge-glow[data-side="right"]')
    if (!left || !right) return
    const lights = [left, right]
    const pointers = new Set<number>()
    let gesture: Gesture | null = null
    let slide: HTMLElement | null = null
    let frame = 0
    let offset = 0
    let target = 0
    let limit = 1
    let returning: { offset: number; start: number } | null = null
    let active = false
    let zoomGuard = 0
    let lastPointerDown = 0

    const setActive = (value: boolean) => {
      if (active === value) return
      active = value
      window.clearTimeout(zoomGuard)
      // Only phase changes render React; pointer movement stays on the frame clock.
      if (value) setEdgePulling?.(true)
      else {
        // A completed or canceled drag must not count as the first tap of a double tap.
        const remaining = Math.max(0, GALLERY_DOUBLE_TAP_DELAY - (performance.now() - lastPointerDown))
        if (remaining) zoomGuard = window.setTimeout(() => setEdgePulling?.(false), remaining)
        else setEdgePulling?.(false)
      }
    }

    const draw = (value: number) => {
      offset = value
      if (slide) {
        // The carousel and zoom wrapper keep ownership of their own transforms.
        slide.style.translate = value && !readState().reducedMotion ? `${value}px 0` : ''
        slide.style.willChange = value ? 'translate' : ''
      }
      for (const [index, light] of lights.entries()) {
        const strength = (index === 0 ? value > 0 : value < 0) ? Math.abs(value) / limit : 0
        light.style.opacity = String(strength)
        light.style.transform = `scale(${0.4 + strength * 0.6}, ${0.85 + strength * 0.15})`
        const active = String(strength > 0 && gesture?.phase === 'edge')
        if (light.dataset.active !== active) light.dataset.active = active
      }
    }
    const stopFrame = () => {
      cancelAnimationFrame(frame)
      frame = 0
      returning = null
    }
    const reset = () => {
      stopFrame()
      gesture = null
      target = 0
      draw(0)
      slide = null
      setActive(false)
    }
    resetRef.current = reset
    const tick = (time: number) => {
      frame = 0
      if (!returning) { draw(target); return }
      // Analytic critical damping stays stable at 60/120 Hz and after a delayed frame.
      const elapsed = Math.max(0, time - returning.start) / 1000
      const decay = (1 + RETURN_RATE * elapsed) * Math.exp(-RETURN_RATE * elapsed)
      const value = returning.offset * decay
      if (Math.abs(value) < 0.08) { reset(); return }
      draw(value)
      frame = requestAnimationFrame(tick)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(tick) }
    const release = () => {
      gesture = null
      stopFrame()
      if (!offset || readState().reducedMotion) { reset(); return }
      returning = { offset, start: performance.now() }
      draw(offset)
      schedule()
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      pointers.add(event.pointerId)
      const state = readState()
      if (pointers.size !== 1 || !event.isPrimary || state.zoomed || !(event.target instanceof Node) || !stage.contains(event.target)) {
        reset()
        return
      }
      if (state.index !== 0 && state.index !== state.count - 1) return
      const moving = stage.querySelector('.yarl__carousel')?.getAnimations().some(animation =>
        animation.playState === 'running' || animation.pending)
      if (moving) return
      stopFrame()
      lastPointerDown = performance.now()
      slide = stage.querySelector<HTMLElement>('.yarl__slide_current')
      limit = Math.min(80, stage.clientWidth * 0.16)
      const direction = state.index === 0 ? 1 : -1
      // Invert the resistance curve to catch an unfinished return without a jump.
      const distance = Math.abs(offset)
      const carried = distance ? direction * (distance * limit / (RESISTANCE * (limit - distance)) + SLOP) : 0
      gesture = { id: event.pointerId, x: event.clientX - carried, y: event.clientY,
        index: state.index, direction, phase: distance ? 'edge' : 'pending' }
      target = offset
    }
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      const state = readState()
      if (state.zoomed || state.index !== gesture.index || pointers.size !== 1) { reset(); return }
      const dx = event.clientX - gesture.x
      const dy = event.clientY - gesture.y
      if (gesture.phase === 'pending') {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= SLOP) return
        // Lock intent once: vertical movement and ordinary navigation belong to the viewer.
        if (Math.abs(dx) <= Math.abs(dy) * 1.2 || dx * gesture.direction <= 0) { reset(); return }
        gesture.phase = 'edge'
        setActive(true)
      }
      if (dx * gesture.direction <= 0) { reset(); return }
      // Do not let a re-grab start the carousel while the edge still owns the drag.
      event.stopPropagation()
      const distance = Math.max(0, dx * gesture.direction - SLOP)
      target = gesture.direction * limit * RESISTANCE * distance / (limit + RESISTANCE * distance)
      schedule()
    }
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (gesture?.id === event.pointerId) release()
    }
    const cancel = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (gesture?.id === event.pointerId) reset()
    }
    const interrupt = () => { pointers.clear(); reset() }
    const events = new AbortController()
    const options = { capture: true, passive: true, signal: events.signal }
    window.addEventListener('pointerdown', down, options)
    window.addEventListener('pointermove', move, options)
    window.addEventListener('pointerup', up, options)
    window.addEventListener('pointercancel', cancel, options)
    window.addEventListener('blur', interrupt, { signal: events.signal })
    document.addEventListener('visibilitychange', interrupt, { signal: events.signal })
    // Includes rotation, fullscreen and thumbnail toggles without reading layout per frame.
    const observer = new ResizeObserver(interrupt)
    observer.observe(stage)
    return () => {
      events.abort()
      observer.disconnect()
      interrupt()
      window.clearTimeout(zoomGuard)
      setEdgePulling?.(false)
      resetRef.current = () => {}
    }
  }, [stageRef, enabled, readState, setEdgePulling])

  useEffect(() => { resetRef.current() }, [currentIndex, slides.length, reducedMotion])
}
