import { useEffect, useRef, type RefObject } from 'react'
import { useController, useEventCallback, useLightboxProps, useLightboxState } from 'yet-another-react-lightbox'

/** Navigate only over the thumbnail strip, without queuing wheel animations. */
export function useThumbnailWheel(stageRef: RefObject<HTMLDivElement | null>) {
  const { prev, next } = useController()
  const { currentIndex, slides } = useLightboxState()
  const { animation } = useLightboxProps()
  const gesture = useRef({ distance: 0, direction: 0, lastEvent: 0, readyAt: 0, stepDirection: 0 })
  const wheel = useEventCallback((event: WheelEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || slides.length < 2) return
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    if (!delta) return
    if (event.cancelable) event.preventDefault()
    event.stopPropagation()

    const now = performance.now()
    const direction = Math.sign(delta)
    const input = gesture.current
    if (now - input.lastEvent > 180 || direction !== input.direction) input.distance = 0
    input.lastEvent = now
    input.direction = direction
    // Discard same-direction input while the current slide is moving. No
    // timer or trailing callback can keep flipping images after input stops.
    if (direction === input.stepDirection && now < input.readyAt) {
      input.distance = 0
      return
    }
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1
    input.distance += delta * unit
    if (Math.abs(input.distance) < 40) return
    input.distance = 0
    input.stepDirection = direction
    input.readyAt = now + Math.max(180, animation.navigation ?? animation.swipe)
    if (direction > 0 && currentIndex < slides.length - 1) next()
    else if (direction < 0 && currentIndex > 0) prev()
  })

  useEffect(() => {
    const viewer = stageRef.current?.closest('.image-gallery')
    const strip = viewer?.querySelector<HTMLElement>('.yarl__thumbnails_container')
    if (!viewer || !strip) return
    const events = new AbortController()
    const reset = () => {
      gesture.current = { distance: 0, direction: 0, lastEvent: 0, readyAt: 0, stepDirection: 0 }
    }
    strip.addEventListener('wheel', wheel, { passive: false, signal: events.signal })
    strip.addEventListener('pointerleave', reset, { signal: events.signal })
    viewer.addEventListener('pointerdown', reset, { signal: events.signal })
    viewer.addEventListener('keydown', reset, { signal: events.signal })
    return () => { events.abort(); reset() }
  }, [stageRef, wheel])
}
