import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'

const flightDuration = 4400

export function ContactAirmail() {
  const id = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wakeRef = useRef<SVGPathElement>(null)
  const flightRef = useRef<Animation | null>(null)
  const effectsRef = useRef<Animation[]>([])
  const [isFlying, setIsFlying] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const clearEffects = useCallback(() => {
    effectsRef.current.forEach((effect) => effect.cancel())
    effectsRef.current = []
  }, [])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stopFlight = () => {
      const flight = flightRef.current
      if (!flight) return
      flightRef.current = null
      flight.cancel()
      clearEffects()
      setIsFlying(false)
      setAnnouncement('纸飞机已返回原位。')
    }
    window.addEventListener('resize', stopFlight)
    preference.addEventListener('change', stopFlight)
    return () => {
      window.removeEventListener('resize', stopFlight)
      preference.removeEventListener('change', stopFlight)
      const flight = flightRef.current
      flightRef.current = null
      flight?.cancel()
      clearEffects()
    }
  }, [clearEffects])

  async function fly() {
    const button = buttonRef.current
    const container = containerRef.current
    if (!button || !container || flightRef.current) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const compact = window.matchMedia('(max-width: 600px)').matches
    const scale = container.clientWidth / 360
    const route = flightRoute(scale, compact)
    const timing = { duration: reducedMotion ? 450 : flightDuration, easing: 'cubic-bezier(0.35, 0, 0.25, 1)' }
    const animation = button.animate(
      reducedMotion
        ? [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }]
        : route.frames,
      timing,
    )
    flightRef.current = animation
    if (!reducedMotion && wakeRef.current) {
      const originX = (button.offsetLeft + button.offsetWidth / 2) / scale
      const originY = (button.offsetTop + button.offsetHeight / 2) / scale
      wakeRef.current.setAttribute('d', route.points.map(([x, y], index) =>
        `${index ? 'L' : 'M'}${originX + x / scale} ${originY + y / scale}`,
      ).join(' '))
      effectsRef.current = [wakeRef.current.animate(route.wakeFrames, timing)]
    }
    setIsFlying(true)
    setAnnouncement(reducedMotion ? '收到你的问候。' : '纸飞机出发了。')
    try {
      await animation.finished
      if (flightRef.current === animation) {
        flightRef.current = null
        clearEffects()
        setIsFlying(false)
        setAnnouncement('纸飞机已返回原位，可以再次起飞。')
      }
    } catch {
      // Resizing, changing motion preferences, or leaving the page cancels flight.
    }
  }

  return (
    <div
      className="correspondence-airmail"
      data-flying={isFlying}
      ref={containerRef}
      style={{ '--airmail-flight-duration': `${flightDuration}ms` } as CSSProperties}
    >
      <div className="correspondence-airmail-scene">
        <svg className="correspondence-airmail-decoration" viewBox="0 0 360 290" fill="none" aria-hidden="true" focusable="false">
          <path className="correspondence-airmail-trail" d="M18 239C82 260 154 264 177 226S140 151 123 186 191 260 239 196 226 122 236 89" />
        </svg>
        <svg className="correspondence-airmail-wake" viewBox="0 0 360 290" fill="none" aria-hidden="true" focusable="false">
          <path className="correspondence-flight-wake" ref={wakeRef} pathLength="1" />
        </svg>
        <button
          className="correspondence-plane-button"
          type="button"
          aria-label="让纸飞机飞一圈"
          aria-disabled={isFlying}
          title="点一下，让问候飞一会儿"
          onClick={fly}
          ref={buttonRef}
        >
          <svg className="correspondence-plane-model" viewBox="0 0 128 108" fill="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={`${id}-wing`} x1="31" y1="33" x2="68" y2="66" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fffef8" /><stop offset="0.58" stopColor="#eee9df" /><stop offset="1" stopColor="#c8bdd7" />
              </linearGradient>
              <linearGradient id={`${id}-fold`} x1="112" y1="14" x2="61" y2="83" gradientUnits="userSpaceOnUse">
                <stop stopColor="#b5a3ce" /><stop offset="1" stopColor="#665282" />
              </linearGradient>
              <linearGradient id={`${id}-right`} x1="100" y1="22" x2="91" y2="98" gradientUnits="userSpaceOnUse">
                <stop stopColor="#faf6ff" /><stop offset="0.46" stopColor="#dacdea" /><stop offset="1" stopColor="#aa93c6" />
              </linearGradient>
            </defs>
            <g strokeLinejoin="round">
              <path d="m57 61 4 23 57-74Z" fill={`url(#${id}-fold)`} stroke="#857098" strokeWidth="0.7" />
              <path d="M10 42 118 10 57 61Z" fill={`url(#${id}-wing)`} stroke="#d9d0dc" strokeWidth="0.8" />
              <path d="m118 10-51 59 13 27Z" fill={`url(#${id}-right)`} stroke="#ad98c4" strokeWidth="0.8" />
              <path d="m10 42 47 19 61-51M67 69l13 27" stroke="#fffdf8" strokeOpacity="0.85" strokeWidth="1.2" />
              <path d="m57 61 4 23 6-15" stroke="#78628e" strokeWidth="0.8" />
              <path d="m21 42 69-21" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="0.8" />
            </g>
          </svg>
        </button>
      </div>
      <span className="correspondence-airmail-caption" aria-hidden="true">a little hello, on its way</span>
      <span className="sr-only" role="status">{announcement}</span>
    </div>
  )
}

type Point = [number, number]
type Curve = [Point, Point, Point, Point]

function flightRoute(scale: number, compact: boolean) {
  // Coordinates stay relative to the illustration, keeping the loop in its whitespace.
  const horizontalScale = scale * (compact ? 1 : scale < 0.5 ? 0.48 : scale < 0.6 ? 0.82 : 1)
  const verticalScale = !compact && scale < 0.7 ? scale * 0.35 : scale
  const curves: Curve[] = compact
    ? [
        [[0, 0], [-35, 30], [-115, 20], [-145, 48]],
        [[-145, 48], [-220, 100], [-205, 155], [-125, 115]],
        [[-125, 115], [-35, 105], [-25, 30], [0, 0]],
      ]
    : [
        [[0, 0], [-55, -180], [-330, -125], [-270, -95]],
        [[-270, -95], [-210, -65], [-100, 120], [-90, 30]],
        [[-90, 30], [-80, -60], [-30, 25], [0, 0]],
      ]
  let lastAngle = 0
  const points: Point[] = []
  const distances: number[] = []
  const frames: Keyframe[] = Array.from({ length: 91 }, (_, index) => {
    const progress = index / 90
    const segment = Math.min(2, Math.floor(progress * 3))
    const t = progress * 3 - segment
    const [a, b, c, d] = curves[segment]
    const u = 1 - t
    const x = u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0]
    const y = u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1]
    const dx = 3 * u ** 2 * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t ** 2 * (d[0] - c[0])
    const dy = 3 * u ** 2 * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t ** 2 * (d[1] - c[1])
    let angle = Math.atan2(dy * verticalScale, dx * horizontalScale) * 180 / Math.PI + 40
    while (angle - lastAngle > 180) angle -= 360
    while (angle - lastAngle < -180) angle += 360
    lastAngle = angle
    angle *= Math.min(1, progress / 0.1)
    const landing = Math.max(0, (progress - 0.88) / 0.12)
    angle += (Math.round(angle / 360) * 360 - angle) * landing
    const lift = Math.sin(progress * Math.PI)
    const drift = Math.sin(progress * Math.PI * 4) * 3 * scale * lift
    const point: Point = [x * horizontalScale, y * verticalScale + drift]
    const previous = points[index - 1] ?? point
    distances.push((distances[index - 1] ?? 0) + Math.hypot(point[0] - previous[0], point[1] - previous[1]))
    points.push(point)
    angle += Math.sin(progress * Math.PI * 6) * 2 * lift
    return { offset: progress, transform: `translate(${point[0]}px, ${point[1]}px) rotate(${angle}deg) scale(${1 + lift * 0.08})` }
  })
  const length = distances[distances.length - 1]
  const wakeFrames: Keyframe[] = distances.map((distance, index) => {
    const progress = index / 90
    return {
      offset: progress,
      strokeDashoffset: String(0.14 - distance / length),
      opacity: Math.min(1, progress / 0.08, (1 - progress) / 0.16) * 0.65,
    }
  })
  return { frames, points, wakeFrames }
}
