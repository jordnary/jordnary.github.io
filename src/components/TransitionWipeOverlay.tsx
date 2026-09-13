import { useLayoutEffect, useRef, type TransitionEvent } from 'react'
import {
  homepageTransitionPaths,
  homepageTransitionTiming,
  type HomepageTransitionPhase,
} from '../lib/homepage-transition'

type TransitionWipeOverlayProps = {
  phase: HomepageTransitionPhase
  onComplete: () => void
}

const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi

type ParsedPath = { parts: string[]; values: number[] }

function parsePath(path: string): ParsedPath {
  return { parts: path.split(numberPattern), values: path.match(numberPattern)?.map(Number) ?? [] }
}

const introPath = parsePath(homepageTransitionPaths.intro)
const expandedPath = parsePath(homepageTransitionPaths.expanded)

function interpolatePath(progress: number) {
  const value = Math.max(0, Math.min(1, progress))
  let path = introPath.parts[0] ?? ''
  for (let index = 0; index < introPath.values.length; index += 1) {
    const start = introPath.values[index] ?? 0
    const end = expandedPath.values[index] ?? start
    path += String(start + (end - start) * value)
    path += introPath.parts[index + 1] ?? ''
  }
  return path
}

function easeOutQuad(value: number) { return 1 - (1 - value) ** 2 }

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2
}

export function TransitionWipeOverlay({ phase, onComplete }: TransitionWipeOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const frameRef = useRef<number | null>(null)
  // Run before the browser paints the phase change.  A normal effect leaves
  // one frame where the newly entering wave still has its static intro path.
  useLayoutEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    const path = pathRef.current
    const svg = svgRef.current
    if (!path || !svg) return
    if (phase === 'intro') {
      path.setAttribute('d', homepageTransitionPaths.intro)
      svg.style.transform = `scaleY(${homepageTransitionTiming.shapeScale[0]})`
      return
    }
    if (phase === 'settling') {
      path.setAttribute('d', homepageTransitionPaths.expanded)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const duration = reducedMotion ? 0 : homepageTransitionTiming.waveExitDurationMs
      const startScale = homepageTransitionTiming.shapeScale[2]
      const endScale = homepageTransitionTiming.waveExitScale
      const startTime = performance.now()
      const tick = (now: number) => {
        const progress = duration === 0 ? 1 : Math.min(1, (now - startTime) / duration)
        const eased = easeInOutCubic(progress)
        svg.style.transform = `scaleY(${startScale + (endScale - startScale) * eased})`
        if (progress < 1) frameRef.current = requestAnimationFrame(tick)
        else frameRef.current = null
      }
      tick(startTime)
      return () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
    if (phase !== 'pushing') return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? 0 : homepageTransitionTiming.pushDurationMs
    const [startScale, peakScale, endScale] = homepageTransitionTiming.shapeScale
    const split = homepageTransitionTiming.shapeScaleSplitMs
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const rawProgress = duration === 0 ? 1 : Math.min(1, elapsed / duration)
      path.setAttribute('d', interpolatePath(easeOutQuad(rawProgress)))
      const scale = duration === 0 ? endScale : elapsed < split
        ? startScale + (peakScale - startScale) * easeOutQuad(elapsed / split)
        : peakScale + (endScale - peakScale) * easeOutQuad(Math.min(1, (elapsed - split) / (duration - split)))
      // Scale the SVG independently from the shared Push and the wave's exit.
      svg.style.transform = `scaleY(${scale})`
      if (rawProgress < 1) frameRef.current = requestAnimationFrame(tick)
      else frameRef.current = null
    }
    tick(startTime)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [phase])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (phase === 'settling' && event.target === event.currentTarget && event.propertyName === 'transform') {
      onComplete()
    }
  }

  return (
    <div
      aria-hidden="true"
      className="transition-wipe-overlay"
      onTransitionEnd={handleTransitionEnd}
    >
      <svg
        preserveAspectRatio="none"
        ref={svgRef}
        style={{ transform: `scaleY(${homepageTransitionTiming.shapeScale[0]})` }}
        viewBox={homepageTransitionTiming.viewBox}
      >
        <defs>
          <linearGradient id="transition-surface" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d={homepageTransitionPaths.intro} ref={pathRef} />
      </svg>
    </div>
  )
}
