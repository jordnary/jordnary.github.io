import { useLayoutEffect, useRef } from 'react'

type Point = { x: number; y: number }

export function NotFoundCursor() {
  const cursorRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const cursor = cursorRef.current
    const scene = cursor?.parentElement
    if (!cursor || !scene) return

    const pointer = matchMedia('(hover: hover) and (pointer: fine)')
    const motion = matchMedia('(prefers-reduced-motion: no-preference)')
    let target: Point | null = null
    let position: Point | null = null
    let frame = 0
    let previousTime = 0

    const clear = () => {
      cancelAnimationFrame(frame)
      frame = previousTime = 0
      target = position = null
      cursor.dataset.active = 'false'
    }

    const draw = (time: number) => {
      frame = 0
      if (!target || !position || !pointer.matches || !motion.matches || document.hidden) {
        clear()
        return
      }

      // Ease toward the latest mouse position at the same rate on any display.
      const elapsed = previousTime ? Math.min(time - previousTime, 64) : 1000 / 60
      const follow = 1 - Math.exp(-elapsed / 95)
      position.x += (target.x - position.x) * follow
      position.y += (target.y - position.y) * follow
      const settling = Math.hypot(target.x - position.x, target.y - position.y) > .1
      if (!settling) position = { ...target }

      // The transparent model and its speech bubble pass pointer events to the scene.
      const companion = document.querySelector('.live2d-companion:not([hidden])')
      const overlaps = (element: Element) => {
        const { left, top, right, bottom } = element.getBoundingClientRect()
        return top < bottom && [target, position].some(point => point
          && point.x >= left && point.x <= right && point.y >= top && point.y <= bottom)
      }
      const bubble = companion?.querySelector('.live2d-dialogue p')
      if (companion && (overlaps(companion) || (bubble && overlaps(bubble)))) {
        clear()
        return
      }

      const bounds = scene.getBoundingClientRect()
      cursor.style.transform = `translate3d(${position.x - bounds.left}px, ${position.y - bounds.top}px, 0) translate(-50%, -50%)`
      cursor.dataset.active = 'true'
      previousTime = settling ? time : 0
      if (settling) frame = requestAnimationFrame(draw)
    }

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !pointer.matches || !motion.matches || document.hidden) {
        clear()
        return
      }
      target = { x: event.clientX, y: event.clientY }
      // First entry starts under the pointer, without flying in from a corner.
      position ??= { ...target }
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Tab') clear()
    }
    const availabilityChanged = () => {
      if (!pointer.matches || !motion.matches) clear()
    }

    scene.addEventListener('pointermove', move, { passive: true })
    scene.addEventListener('pointerleave', clear)
    document.addEventListener('pointercancel', clear)
    document.addEventListener('visibilitychange', clear)
    document.addEventListener('keydown', keyboard, true)
    window.addEventListener('blur', clear)
    window.addEventListener('resize', clear)
    pointer.addEventListener('change', availabilityChanged)
    motion.addEventListener('change', availabilityChanged)

    return () => {
      clear()
      scene.removeEventListener('pointermove', move)
      scene.removeEventListener('pointerleave', clear)
      document.removeEventListener('pointercancel', clear)
      document.removeEventListener('visibilitychange', clear)
      document.removeEventListener('keydown', keyboard, true)
      window.removeEventListener('blur', clear)
      window.removeEventListener('resize', clear)
      pointer.removeEventListener('change', availabilityChanged)
      motion.removeEventListener('change', availabilityChanged)
    }
  }, [])

  return <span ref={cursorRef} className="not-found-cursor" data-active="false" aria-hidden="true" />
}
