import { useEffect, useRef } from 'react'

export function ScrollProgress() {
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const progress = progressRef.current

    if (!progress) {
      return
    }

    let frameId = 0

    const updateProgress = () => {
      frameId = 0

      const root = document.documentElement
      const maxScroll = root.scrollHeight - root.clientHeight
      const currentProgress =
        maxScroll > 0 ? root.scrollTop / maxScroll : 0
      const clampedProgress = Math.min(1, Math.max(0, currentProgress))

      progress.style.transform = `scaleX(${clampedProgress})`
    }

    const scheduleUpdate = () => {
      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateProgress)
      }
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)

      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  return <div aria-hidden="true" className="scroll-progress" ref={progressRef} />
}
