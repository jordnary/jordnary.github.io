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
    const compact = getComputedStyle(container).position !== 'absolute'
    const scale = container.getBoundingClientRect().width / 360
    const route = flightRoute(scale, compact, measureFlightSpace(container, button))
    const timing = {
      duration: reducedMotion ? 450 : flightDuration,
      easing: compact ? 'cubic-bezier(0.45, 0, 0.55, 1)' : 'cubic-bezier(0.35, 0, 0.25, 1)',
    }
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
      wakeRef.current.style.strokeDasharray = `${route.wakeLength} 1`
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
type FlightSpace = {
  origin: Point
  radius: number
  plane: { width: number; height: number }
  viewport: { left: number; right: number; top: number; bottom: number }
  text: DOMRect[]
}

function measureFlightSpace(container: HTMLElement, button: HTMLElement): FlightSpace | undefined {
  const intro = container.closest('.correspondence-hero')?.querySelector('.correspondence-intro')
  if (!intro) return
  const text: DOMRect[] = []
  const nodes = document.createTreeWalker(intro, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  while (nodes.nextNode()) {
    if (!nodes.currentNode.textContent?.trim()) continue
    range.selectNodeContents(nodes.currentNode)
    text.push(...Array.from(range.getClientRects()))
  }
  const bounds = button.getBoundingClientRect()
  const drawing = button.querySelector<SVGGElement>('.correspondence-plane-model > g')?.getBBox()
  const drawingScale = bounds.width / 128
  return {
    origin: [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
    // Reserve the full turning envelope, including the flight's subtle scale lift.
    radius: Math.hypot(bounds.width, bounds.height) * 0.54,
    // Fit the visible paper, rather than the SVG's transparent outer corners.
    plane: drawing
      ? { width: drawing.width * drawingScale, height: drawing.height * drawingScale }
      : { width: bounds.width, height: bounds.height },
    viewport: { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight },
    text,
  }
}

function sampleCurve(curves: Curve[], progress: number) {
  const segment = Math.min(curves.length - 1, Math.floor(progress * curves.length))
  const t = progress * curves.length - segment
  const [a, b, c, d] = curves[segment]
  const u = 1 - t
  return {
    x: u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0],
    y: u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1],
    dx: 3 * u ** 2 * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t ** 2 * (d[0] - c[0]),
    dy: 3 * u ** 2 * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t ** 2 * (d[1] - c[1]),
  }
}

function flightFits(samples: ReturnType<typeof sampleCurve>[], horizontalScale: number, verticalScale: number,
  scale: number, space: FlightSpace, compact: boolean) {
  return samples.every(({ x, y, dx, dy }, index) => {
    const progress = index / 180
    const lift = Math.sin(progress * Math.PI)
    const centerX = space.origin[0] + x * horizontalScale
    const centerY = space.origin[1] + y * verticalScale
      + Math.sin(progress * Math.PI * (compact ? 2 : 4)) * (compact ? 1.5 : 3) * scale * lift
    const angle = Math.atan2(dy * verticalScale, dx * horizontalScale)
      + (40 + Math.sin(progress * Math.PI * 6) * 2 * lift) * Math.PI / 180
    const cosine = Math.abs(Math.cos(angle))
    const sine = Math.abs(Math.sin(angle))
    // The turning bounds leave more usable room than a fixed enclosing circle.
    const size = 1 + lift * (compact ? -0.04 : 0.08)
    const margin = compact ? 8 : 13
    const halfWidth = (space.plane.width * cosine + space.plane.height * sine) / 2 * size + margin
    const halfHeight = (space.plane.width * sine + space.plane.height * cosine) / 2 * size + margin
    if (compact && (centerX - halfWidth < space.viewport.left || centerX + halfWidth > space.viewport.right
      || centerY - halfHeight < space.viewport.top || centerY + halfHeight > space.viewport.bottom)) return false
    return space.text.every(rect =>
      centerX - halfWidth >= rect.right || centerX + halfWidth <= rect.left
      || centerY - halfHeight >= rect.bottom || centerY + halfHeight <= rect.top)
  })
}

function fitInlineFlight(curves: Curve[], verticalScale: number, scale: number, space: FlightSpace) {
  const padding = space.radius + 10
  const samples = Array.from({ length: 181 }, (_, index) => sampleCurve(curves, index / 180))
  const rise = -Math.min(...samples.map(point => point.y))
  const fall = Math.max(...samples.map(point => point.y))
  const driftRoom = 3 * scale
  verticalScale = Math.max(0, Math.min(verticalScale,
    (space.origin[1] - space.viewport.top - padding - driftRoom) / rise,
    (space.viewport.bottom - space.origin[1] - padding - driftRoom) / fall))

  let lower = 0
  let upper = Math.max(0, space.origin[0] - space.viewport.left - padding)
    / -Math.min(...samples.map(point => point.x))
  for (let iteration = 0; iteration < 20; iteration++) {
    const candidate = (lower + upper) / 2
    if (flightFits(samples, candidate, verticalScale, scale, space, false)) {
      lower = candidate
    } else {
      upper = candidate
    }
  }
  return { horizontalScale: lower, verticalScale }
}

function fitStackedFlight(curves: Curve[], scale: number, space: FlightSpace) {
  const samples = Array.from({ length: 181 }, (_, index) => sampleCurve(curves, index / 180))
  const reach = -Math.min(...samples.map(point => point.x))
  const horizontalScale = Math.min(scale,
    Math.max(0, space.origin[0] - space.viewport.left - space.radius - 10) / reach)
  let lower = 0
  let upper = scale
  for (let iteration = 0; iteration < 20; iteration++) {
    const candidate = (lower + upper) / 2
    if (flightFits(samples, horizontalScale, candidate, scale, space, true)) lower = candidate
    else upper = candidate
  }
  return { horizontalScale, verticalScale: lower }
}

function flightRoute(scale: number, compact: boolean, space?: FlightSpace) {
  // Coordinates stay relative to the illustration, keeping the loop in its whitespace.
  let horizontalScale = scale
  let verticalScale = !compact && scale < 0.7 ? scale * 0.35 : scale
  const curves: Curve[] = compact
    ? [
        // Sweep left, dip gently, then rise into an S-shaped return like the wide layout.
        // Matching handles keep each change of direction continuous above the dashed loop.
        [[0, 0], [-20, -35], [-250, -12], [-285, 38]],
        [[-285, 38], [-320, 88], [-100, 120], [-90, 30]],
        [[-90, 30], [-80, -60], [-30, 25], [0, 0]],
      ]
    : [
        [[0, 0], [-55, -180], [-330, -125], [-270, -95]],
        [[-270, -95], [-210, -65], [-100, 120], [-90, 30]],
        [[-90, 30], [-80, -60], [-30, 25], [0, 0]],
      ]
  if (space) {
    // The illustration controls plane size; the measured whitespace controls travel.
    const fitted = compact ? fitStackedFlight(curves, scale, space) : fitInlineFlight(curves, verticalScale, scale, space)
    horizontalScale = fitted.horizontalScale
    verticalScale = fitted.verticalScale
  }
  let lastAngle = 0
  const points: Point[] = []
  const distances: number[] = []
  const angles: number[] = []
  const steps = 180
  const frames: Keyframe[] = Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps
    const { x, y, dx, dy } = sampleCurve(curves, progress)
    let angle = Math.atan2(dy * verticalScale, dx * horizontalScale) * 180 / Math.PI + 40
    while (angle - lastAngle > 180) angle -= 360
    while (angle - lastAngle < -180) angle += 360
    lastAngle = angle
    const departure = Math.min(1, progress / 0.1)
    angle *= departure * departure * (3 - 2 * departure)
    const landing = Math.max(0, (progress - 0.88) / 0.12)
    angle += (Math.round(angle / 360) * 360 - angle) * landing * landing * (3 - 2 * landing)
    const lift = Math.sin(progress * Math.PI)
    const drift = Math.sin(progress * Math.PI * (compact ? 2 : 4)) * (compact ? 1.5 : 3) * scale * lift
    const point: Point = [x * horizontalScale, y * verticalScale + drift]
    const previous = points[index - 1] ?? point
    distances.push((distances[index - 1] ?? 0) + Math.hypot(point[0] - previous[0], point[1] - previous[1]))
    points.push(point)
    angle += Math.sin(progress * Math.PI * 6) * 2 * lift
    angles.push(angle)
    return { offset: progress, transform: `translate(${point[0]}px, ${point[1]}px) rotate(${angle}deg) scale(${1 + lift * (compact ? -0.04 : 0.08)})` }
  })
  const length = distances[distances.length - 1]
  {
    // Give turns their own time as the route widens; keep the wake on the same clock.
    const turnRadius = Math.max(12, scale * 60)
    const schedule = [0]
    for (let index = 1; index < frames.length; index++) {
      const turn = Math.abs(angles[index] - angles[index - 1]) * Math.PI / 180
      schedule.push(schedule[index - 1] + distances[index] - distances[index - 1] + turnRadius * turn)
    }
    const total = schedule[schedule.length - 1]
    frames.forEach((frame, index) => { frame.offset = schedule[index] / total })
  }
  // Keep a short wake behind the wings as the compact glide spreads across the open area.
  const wakeLength = compact ? Math.min(0.3, 56 / length) : 0.14
  const wakeFrames: Keyframe[] = distances.map((distance, index) => {
    const progress = index / steps
    return {
      offset: frames[index].offset,
      strokeDashoffset: String(wakeLength - distance / length),
      opacity: Math.min(1, progress / 0.08, (1 - progress) / 0.16) * 0.65,
    }
  })
  return { frames, points, wakeFrames, wakeLength }
}
