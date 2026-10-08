import { useEffect, useRef, type MouseEvent } from 'react'
import { scrollAndFocus } from './scrollFocus'

/** Connect a trigger's onClick to a focusable target's ref. */
export function useScrollFocus<T extends HTMLElement>() {
  const targetRef = useRef<T>(null)
  const cleanup = useRef<(() => void) | undefined>(undefined)

  useEffect(() => () => cleanup.current?.(), [])

  const focusTarget = (event: MouseEvent<HTMLElement>) => {
    if (!targetRef.current) return
    const native = event.nativeEvent
    const fromMouse = event.detail > 0 && (
      'pointerType' in native
        ? native.pointerType === 'mouse'
        : window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
    cleanup.current = scrollAndFocus(targetRef.current, {
      viewportY: fromMouse ? event.clientY : undefined,
    })
  }

  return { targetRef, focusTarget }
}
