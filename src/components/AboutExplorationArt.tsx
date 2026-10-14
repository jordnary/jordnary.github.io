import { useId } from 'react'

// Project a twisted ribbon into a fixed viewBox without a canvas or animation frames.
const ribbons = Array.from({ length: 17 }, (_, index) => {
  const across = index / 8 - 1
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

export function AboutExplorationArt() {
  const gradientId = useId()

  return (
    <figure className="journey-atlas">
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
            {ribbons.map((path, index) => <path key={index} d={path} opacity={index % 4 === 0 ? 0.72 : 0.32} />)}
          </g>
          <ellipse className="journey-atlas-orbit" cx="270" cy="226" rx="218" ry="102" transform="rotate(27 270 226)" />
          <path className="journey-atlas-trail" d="M91 309C138 365 333 346 406 233S401 70 337 85" pathLength="1" />
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
          <g className="journey-atlas-spark" transform="translate(270 226)">
            <path d="M0-20C0-6-6 0-20 0-6 0 0 6 0 20 0 6 6 0 20 0 6 0 0-6 0-20Z" />
            <path d="M29-31v10m-5-5h10" />
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
