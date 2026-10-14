import { useEffect, useId, useRef } from 'react'
import './AboutOutroOrnaments.css'

type SketchRingsProps = {
  x: number
  y: number
  radius: number
  phase: number
  coralLayer?: 1 | 2
}

const ringLayers = [
  { scale: 1, marks: 26 },
  { scale: 0.77, marks: 20 },
  { scale: 0.52, marks: 12 },
]

function SketchRings({ x, y, radius, phase, coralLayer = 2 }: SketchRingsProps) {
  return (
    <g fill="none" strokeLinecap="butt">
      {ringLayers.map(({ scale, marks }, layer) => {
        const ringRadius = radius * scale
        const count = Math.round(marks * radius / 25)

        return (
          <g className="journey-outro-ring-layer" data-layer={layer} key={layer} stroke={layer === coralLayer ? 'var(--outro-dot-coral)' : 'var(--outro-dot-ink)'}>
            {Array.from({ length: count }, (_, index) => {
              const angle = (index / count) * Math.PI * 2 + phase + layer * 0.12 + Math.sin(index * 1.7 + phase) * 0.012
              const wobble = Math.sin(index * 2.3 + phase + layer) * 0.15
              const length = 3.2 + (Math.sin(index * 1.9 + phase + layer) + 1) * 0.2
              const width = 3.3 + (Math.sin(index * 1.3 + phase + layer) + 1) * 0.15
              const innerRadius = ringRadius + wobble - length / 2
              const outerRadius = ringRadius + wobble + length / 2
              const startX = x + Math.cos(angle) * innerRadius
              const startY = y + Math.sin(angle) * innerRadius
              const endX = x + Math.cos(angle) * outerRadius
              const endY = y + Math.sin(angle) * outerRadius

              return (
                <path
                  key={index}
                  d={`M${startX.toFixed(3)} ${startY.toFixed(3)}L${endX.toFixed(3)} ${endY.toFixed(3)}`}
                  strokeWidth={width}
                  opacity={0.94 + (Math.sin(index * 1.4 + layer) + 1) * 0.03}
                />
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

export function AboutOutroOrnaments() {
  const apertureId = useId()
  const ornamentsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ornaments = ornamentsRef.current
    if (!ornaments) return

    const pieces = Array.from(ornaments.querySelectorAll<SVGSVGElement>(':scope > svg'))
    const visible = new Set<Element>()
    const syncMotion = () => {
      pieces.forEach(piece => { piece.dataset.motion = visible.has(piece) && !document.hidden ? 'running' : 'paused' })
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.15) visible.add(entry.target)
        else visible.delete(entry.target)
      })
      syncMotion()
    }, { threshold: [0, 0.15] })

    // Observe fixed SVG bounds so the animated clipping cannot pause its own clock.
    pieces.forEach(piece => observer.observe(piece))
    document.addEventListener('visibilitychange', syncMotion)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return (
    <div className="journey-outro-ornaments" aria-hidden="true" ref={ornamentsRef}>
      <svg className="journey-outro-ornament--left" viewBox="0 0 100 170" focusable="false" overflow="visible" data-motion="paused">
        <SketchRings x={35} y={38} radius={24} phase={0.2} />
        <SketchRings x={57} y={111} radius={34} phase={0.65} coralLayer={1} />
      </svg>
      <svg className="journey-outro-ornament--right" viewBox="0 0 80 80" focusable="false" overflow="visible" data-motion="paused">
        <defs>
          <clipPath id={apertureId} clipPathUnits="userSpaceOnUse">
            <circle className="journey-outro-ring-aperture" cx="40" cy="40" r="32" />
          </clipPath>
        </defs>
        <g className="journey-outro-ring-pulse" clipPath={`url(#${apertureId})`}>
          <SketchRings x={40} y={40} radius={26} phase={0.9} />
        </g>
      </svg>
    </div>
  )
}
