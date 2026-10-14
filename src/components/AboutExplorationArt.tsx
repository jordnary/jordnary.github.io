import { useEffect, useId, useRef } from 'react'
import './AboutExplorationArt.css'

const explorationTrail = 'M91 309C138 365 333 346 406 233S401 70 337 85'

// Project the static ribbon once; only the smaller pencil marks animate.
const ribbons = Array.from({ length: 13 }, (_, index) => {
  const across = index / 6 - 1
  return Array.from({ length: 181 }, (_, step) => {
    const angle = step / 180 * Math.PI * 2
    const radius = 146 + across * 48 * Math.cos(angle / 2)
    const x = radius * Math.cos(angle) * 1.12
    const y = radius * Math.sin(angle) * 0.76 + across * 54 * Math.sin(angle / 2)
    const tilt = -Math.PI / 6
    const projectedX = 270 + x * Math.cos(tilt) - y * Math.sin(tilt)
    const projectedY = 226 + x * Math.sin(tilt) + y * Math.cos(tilt)
    return `${step === 0 ? 'M' : 'L'}${projectedX.toFixed(2)},${projectedY.toFixed(2)}`
  }).join(' ')
})

function SketchLines({ frames }: { frames: [string, string, string] }) {
  return (
    <g>
      {frames.map((path, index) => (
        <path className="journey-atlas-sketch-frame journey-atlas-motion" key={index} d={path} />
      ))}
    </g>
  )
}

export function AboutExplorationArt() {
  const gradientId = useId()
  const atlasRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const atlas = atlasRef.current
    if (!atlas) return

    let inView = false
    const syncMotion = () => {
      atlas.dataset.motion = inView && !document.hidden ? 'running' : 'paused'
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.15
      syncMotion()
    }, { threshold: [0, 0.15] })
    observer.observe(atlas)
    document.addEventListener('visibilitychange', syncMotion)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return (
    <figure className="journey-atlas" ref={atlasRef} data-motion="paused">
      <div className="journey-atlas-label">好奇心的轨迹</div>
      <div className="journey-atlas-map" aria-hidden="true">
        <svg className="journey-atlas-drawing" viewBox="0 0 540 440" fill="none" focusable="false">
          <defs>
            <linearGradient id={gradientId} x1="80" y1="330" x2="460" y2="100" gradientUnits="userSpaceOnUse">
              <stop className="journey-atlas-color-start" />
              <stop className="journey-atlas-color-end" offset="1" />
            </linearGradient>
          </defs>
          <g className="journey-atlas-guides">
            <circle cx="270" cy="226" r="178" strokeDasharray="1 9" />
            <path d="M62 226h416M270 30v392" strokeDasharray="2 9" />
            <path d="M77 62h10m-5-5v10M462 380h10m-5-5v10" />
          </g>
          <g className="journey-atlas-ribbons" stroke={`url(#${gradientId})`}>
            {ribbons.map((path, index) => <path key={index} d={path} opacity={index % 4 === 0 ? 0.6 : 0.26} />)}
          </g>
          <ellipse className="journey-atlas-orbit" cx="270" cy="226" rx="218" ry="102" transform="rotate(27 270 226)" />
          <path className="journey-atlas-trail" d={explorationTrail} pathLength="1" />
          <path className="journey-atlas-traveler journey-atlas-motion" d={explorationTrail} pathLength="1" />
          <path className="journey-atlas-trail-end" d="m344 78-7 7 10 4" />
          <g className="journey-atlas-annotations">
            <path d="m153 161-26-43H79m327 115 37-26h64m-192 121 27 40h48" />
          </g>
          <g className="journey-atlas-waypoints">
            <circle cx="153" cy="161" r="4" />
            <circle cx="406" cy="233" r="4" />
            <circle cx="315" cy="328" r="4" />
            <circle cx="91" cy="309" r="3" />
          </g>
          <g className="journey-atlas-question" transform="translate(270 226)">
            <g className="journey-atlas-question-rings">
              <path className="journey-atlas-question-ring journey-atlas-motion" pathLength="1" d="M-17 13C-29-2-16-24 3-22S28-2 18 13 0 24-10 20" />
              <path className="journey-atlas-question-ring journey-atlas-motion" pathLength="1" d="M-24 18C-40-6-17-36 8-29S40 3 25 22 1 36-16 29" />
              <path className="journey-atlas-question-ring journey-atlas-motion" pathLength="1" d="M-33 21C-48-6-23-45 9-38S49 3 34 25 7 45-12 38" />
            </g>
            <text y="11" textAnchor="middle">?</text>
          </g>
          <g className="journey-atlas-doodle" transform="translate(43 99) rotate(-9)">
            <g className="journey-atlas-book">
              <path className="journey-atlas-doodle-paper" d="M-19-14Q-8-16 0-9Q8-16 19-14V12Q8 10 0 17Q-8 10-19 12Z" />
              <SketchLines frames={[
                'M-19-14Q-8-16 0-9Q8-16 19-14V12Q8 10 0 17Q-8 10-19 12ZM0-9V17M-13-6l7 3m-7 4 7 3M6-3l7-3m-7 10 7-3',
                'M-20-12Q-8-16 0-8Q9-17 19-15L20 11Q9 9 0 17Q-9 10-18 13ZM0-8V17M-13-5l7 2m-7 5 7 2M0-8Q6-19 11-18L10 7Q4 10 0 17',
                'M-18-15Q-7-15 0-9Q8-14 20-13L19 13Q8 10 0 16Q-9 9-20 11ZM0-9V16M0-9Q-5-18-12-17L-11 7Q-4 10 0 16M6-4l8-2m-8 9 8-3',
              ]} />
            </g>
          </g>
          <g className="journey-atlas-doodle" transform="translate(480 129)">
            <g className="journey-atlas-thought">
              <SketchLines frames={[
                'M-19 4C-31-18 9-27 20-8S-7 30-20 12 3-22 17-9-4 28-16 9 4-18 16-3',
                'M-21 2C-26-22 13-25 22-5S-10 28-22 8 7-23 19-5-9 25-17 5 8-17 18 1',
                'M-17 7C-34-14 5-29 19-11S-3 32-19 15 0-25 16-12 0 29-14 12 0-19 15-6',
              ]} />
            </g>
            <path className="journey-atlas-signal journey-atlas-motion" d="M-17-10 0 16 18-10Z" pathLength="1" />
            <g className="journey-atlas-connections">
              <circle cx="-17" cy="-10" r="3" /><circle cx="18" cy="-10" r="3" /><circle cy="16" r="3" />
            </g>
          </g>
          <g className="journey-atlas-doodle" transform="translate(315 386) rotate(7)">
            <g className="journey-atlas-code journey-atlas-motion">
              <SketchLines frames={[
                'm-10-11-11 11 11 11m20-22 11 11-11 11M4-14l-8 28',
                'm-12-10-10 10 11 12m23-23 9 12-11 10M3-13l-5 27',
                'm-9-12-13 12 12 10m21-21 11 10-10 13M5-15l-9 28',
              ]} />
            </g>
          </g>
        </svg>
        <div className="journey-atlas-topic journey-atlas-topic-cs"><strong>CS</strong><span>理解世界</span></div>
        <div className="journey-atlas-topic journey-atlas-topic-ai"><strong>AI</strong><span>探索可能</span></div>
        <div className="journey-atlas-topic journey-atlas-topic-web"><strong>Web</strong><span>动手创造</span></div>
        <span className="journey-atlas-origin">从一个问题出发</span>
      </div>
      <figcaption>不急着抵达，先保持好奇。<span aria-hidden="true">↗</span></figcaption>
    </figure>
  )
}
