import { useEffect, useRef } from 'react'

const desktopPointerQuery =
  '(hover: hover) and (pointer: fine) and (min-width: 768px)'

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const glow = glowRef.current

    if (!glow) {
      return
    }

    const mediaQuery = window.matchMedia(desktopPointerQuery)
    let frameId = 0
    let isEnabled = false
    let latestX = window.innerWidth / 2
    let latestY = window.innerHeight / 2

    const updatePosition = () => {
      frameId = 0
      glow.style.transform = `translate3d(${latestX}px, ${latestY}px, 0) translate3d(-50%, -50%, 0)`
    }

    const scheduleUpdate = () => {
      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updatePosition)
      }
    }

    const showGlow = () => {
      glow.classList.add('is-visible')
    }

    const hideGlow = () => {
      glow.classList.remove('is-visible')
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return
      }

      latestX = event.clientX
      latestY = event.clientY
      showGlow()
      scheduleUpdate()
    }

    const enableGlow = () => {
      if (isEnabled) {
        return
      }

      isEnabled = true
      scheduleUpdate()
      window.addEventListener('pointermove', handlePointerMove, {
        passive: true,
      })
      window.addEventListener('pointerleave', hideGlow)
    }

    const disableGlow = () => {
      if (!isEnabled) {
        return
      }

      isEnabled = false
      hideGlow()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', hideGlow)

      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
        frameId = 0
      }
    }

    const syncGlowAvailability = () => {
      if (mediaQuery.matches) {
        enableGlow()
      } else {
        disableGlow()
      }
    }

    syncGlowAvailability()
    mediaQuery.addEventListener('change', syncGlowAvailability)

    return () => {
      mediaQuery.removeEventListener('change', syncGlowAvailability)
      disableGlow()
    }
  }, [])

  return <div aria-hidden="true" className="cursor-glow" ref={glowRef} />
}
