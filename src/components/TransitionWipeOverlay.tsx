import { useEffect, useRef, type CSSProperties } from 'react'
import { homepageTransitionPaths, homepageTransitionTiming } from '../lib/homepage-transition'

type TransitionWipeOverlayProps = {
  active: boolean
}

const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi

function interpolatePath(from: string, to: string, progress: number) {
  const fromNumbers = from.match(numberPattern)?.map(Number) ?? []
  const toNumbers = to.match(numberPattern)?.map(Number) ?? []
  let index = 0
  return from.replace(numberPattern, () => {
    const start = fromNumbers[index] ?? 0
    const end = toNumbers[index] ?? start
    index += 1
    return String(start + (end - start) * progress)
  })
}

function easeOutQuad(value: number) {
  return 1 - (1 - value) ** 2
}

export function TransitionWipeOverlay({ active }: TransitionWipeOverlayProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (!active) {
      frameRef.current = null
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startTime = performance.now()
    const duration = reducedMotion ? 0 : homepageTransitionTiming.durationMs

    const tick = (now: number) => {
      const elapsed = now - startTime
      const rawProgress = duration === 0 ? 1 : Math.min(1, elapsed / duration)
      const pathProgress = easeOutQuad(rawProgress)
      const path = pathRef.current
      if (path) path.setAttribute('d', interpolatePath(homepageTransitionPaths.intro, homepageTransitionPaths.expanded, pathProgress))
      if (path) {
        const split = homepageTransitionTiming.shapeScaleSplitMs
        const scaleProgress = duration === 0 ? 1 : Math.min(1, elapsed / split)
        const scale = elapsed < split
          ? homepageTransitionTiming.shapeScale[0] + (homepageTransitionTiming.shapeScale[1] - homepageTransitionTiming.shapeScale[0]) * scaleProgress
          : homepageTransitionTiming.shapeScale[1] + (homepageTransitionTiming.shapeScale[2] - homepageTransitionTiming.shapeScale[1]) * Math.min(1, (elapsed - split) / Math.max(1, duration - split))
        path.style.transform = `scaleY(${scale})`
      }
      if (rawProgress < 1) frameRef.current = requestAnimationFrame(tick)
      else frameRef.current = null
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [active])

  const style = { '--transition-origin': homepageTransitionTiming.shapeTransformOrigin } as CSSProperties
  return (
    <div aria-hidden="true" className={`transition-wipe-overlay${active ? ' is-active' : ''}`} style={style}>
      <svg preserveAspectRatio="none" viewBox={homepageTransitionTiming.viewBox}>
        <path d={homepageTransitionPaths.intro} ref={pathRef} />
      </svg>
    </div>
  )
}
