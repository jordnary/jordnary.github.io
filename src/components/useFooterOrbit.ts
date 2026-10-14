import { useEffect, useRef, type RefObject } from 'react'

const sides = [4, 5, 6, 7, 8, 9, 10]
const beatMs = 1000
const moveMs = 580
const radius = 59
const outerRing = 'M0 -78C45 -82 79 -49 78 0C82 48 46 79 0 78C-48 82 -80 48 -78 0C-82 -46 -44 -80 0 -78Z'

type Point = [number, number]
const mixPoint = (from: Point, to: Point, mix: number): Point => [
  from[0] + (to[0] - from[0]) * mix,
  from[1] + (to[1] - from[1]) * mix,
]
const polygons = sides.map(count => Array.from({ length: count }, (_, index): Point => {
  const angle = index * Math.PI * 2 / count - Math.PI / 2
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}))
const steps = polygons.map((polygon, index) => {
  const next = polygons[(index + 1) % polygons.length]
  if (next.length > polygon.length) {
    // Split exactly one edge. Its midpoint becomes the only new corner;
    // existing corners move directly to their next positions.
    return { from: [...polygon, mixPoint(polygon.at(-1)!, polygon[0], 0.5)], to: next }
  }
  // Fold the surplus corners onto the four square edges for the loop reset.
  const squareCorners = [0, 3, 5, 8, 10]
  return { from: polygon, to: polygon.map((_, vertex) => {
    const edge = squareCorners.findIndex((end, edge) => edge > 0 && vertex < end) - 1
    const fraction = (vertex - squareCorners[edge]) / (squareCorners[edge + 1] - squareCorners[edge])
    return mixPoint(next[edge], next[(edge + 1) % next.length], fraction)
  }) }
})

export function getFooterOrbitPath(elapsed: number) {
  const time = elapsed % (sides.length * beatMs)
  const beat = Math.floor(time / beatMs)
  // Hold the finished shape for 420ms, then rotate and morph together.
  const progress = Math.max(0, (time % beatMs - (beatMs - moveMs)) / moveMs)
  const eased = progress * progress * (3 - 2 * progress)
  const angle = (beat + eased) * Math.PI / 2
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const { from, to } = steps[beat]
  const counter = from.map((point, index) => {
    const [px, py] = mixPoint(point, to[index], eased)
    return `${index ? 'L' : 'M'}${(px * cosine - py * sine).toFixed(3)} ${(px * sine + py * cosine).toFixed(3)}`
  }).join('')
  return `${outerRing} ${counter}Z`
}

export function useFooterOrbit(svgRef: RefObject<SVGSVGElement | null>, isInView: boolean) {
  const elapsed = useRef(0)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const paths = svg.querySelectorAll<SVGPathElement>('[data-footer-orbit]')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previousTime: number | null = null
    let previousPath = ''

    const paint = () => {
      const path = getFooterOrbitPath(elapsed.current)
      if (path === previousPath) return
      // The visible ring and the ink mask must use the same pose on every frame.
      for (const element of paths) element.setAttribute('d', path)
      previousPath = path
    }
    const draw = (now: number) => {
      frame = 0
      if (previousTime !== null) elapsed.current += now - previousTime
      previousTime = now
      paint()
      frame = requestAnimationFrame(draw)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = null
      if (reducedMotion.matches) elapsed.current = 0
      paint()
      if (isInView && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(draw)
    }

    sync()
    document.addEventListener('visibilitychange', sync)
    reducedMotion.addEventListener('change', sync)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', sync)
      reducedMotion.removeEventListener('change', sync)
    }
  }, [svgRef, isInView])
}
