import { useEffect, useRef } from 'react'

export function useLearningHoverLoop<T extends Element>(direction: 'left' | 'right' | 'up') {
  const contentRef = useRef<T>(null)

  useEffect(() => {
    const content = contentRef.current
    const button = content?.closest('a, button')
    if (!content || !button) return
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animation: Animation | undefined

    const stop = () => {
      animation?.cancel()
      animation = undefined
    }
    const enter = (event: Event) => {
      if ((event as PointerEvent).pointerType !== 'mouse' || !hover.matches || reducedMotion.matches) return
      const current = getComputedStyle(content)
      const fromColor = current.color
      const fromTransform = current.transform
      stop()
      const toColor = getComputedStyle(button).getPropertyValue('--pixel-foreground').trim()
      const axis = direction === 'up' ? 'Y' : 'X'
      const travel = direction === 'right' ? 160 : -160
      // Change color only while the content is outside its clipping window.
      animation = content.animate([
        { transform: fromTransform, color: fromColor, offset: 0, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
        { transform: `translate${axis}(${travel}%)`, color: fromColor, offset: 0.45 },
        { transform: `translate${axis}(${-travel}%)`, color: toColor, offset: 0.4501, easing: 'cubic-bezier(0, 0, 0.2, 1)' },
        { transform: `translate${axis}(0)`, color: toColor, offset: 1 },
      ], { duration: 360 })
    }
    // Leaving immediately restores the resting position, including during keyboard focus.
    button.addEventListener('pointerenter', enter)
    const stopEvents = ['pointerleave', 'pointercancel', 'blur'] as const
    stopEvents.forEach(event => button.addEventListener(event, stop))
    reducedMotion.addEventListener('change', stop)
    return () => {
      stop()
      button.removeEventListener('pointerenter', enter)
      stopEvents.forEach(event => button.removeEventListener(event, stop))
      reducedMotion.removeEventListener('change', stop)
    }
  }, [direction])

  return contentRef
}
