import { useEffect, useRef } from 'react'

export function LaunchIntro({ active = true, onEnter }: { active?: boolean; onEnter: () => void }) {
  const introRef = useRef<HTMLDivElement>(null)
  const firstPlanetRef = useRef<HTMLSpanElement>(null)
  const secondPlanetRef = useRef<HTMLSpanElement>(null)
  const syncPlaybackRef = useRef<() => void>(() => {})

  useEffect(() => {
    const intro = introRef.current
    const planets = [firstPlanetRef.current, secondPlanetRef.current]
    if (!intro || planets.some(planet => !planet)) return

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const animations: Array<Animation | undefined> = []
    const syncPlayback = () => {
      const running = intro.dataset.active === 'true' && !document.hidden && !motionPreference.matches
      intro.dataset.running = String(running)
      for (const animation of animations) {
        if (running) animation?.play()
        else animation?.pause()
      }
    }
    syncPlaybackRef.current = syncPlayback

    // Rebuild only when an orbit changes size. The browser interpolates the
    // transform keyframes on the compositor without per-frame DOM writes.
    const resizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const index = planets.findIndex(planet => planet?.parentElement === entry.target)
        const planet = planets[index]
        if (!planet) return
        const duration = index === 0 ? 9000 : 12000
        const currentTime = animations[index]?.currentTime ?? duration * (index === 0 ? 0.12 : 0.42)
        animations[index]?.cancel()
        const animation = planet.animate(orbitKeyframes(entry.contentRect.width, entry.contentRect.height), {
          duration, iterations: Infinity, easing: 'linear', direction: index === 0 ? 'normal' : 'reverse',
        })
        animation.currentTime = currentTime
        animations[index] = animation
      })
      syncPlayback()
    })
    planets.forEach(planet => { if (planet?.parentElement) resizeObserver.observe(planet.parentElement) })
    document.addEventListener('visibilitychange', syncPlayback)
    motionPreference.addEventListener('change', syncPlayback)
    syncPlayback()
    return () => {
      resizeObserver.disconnect()
      animations.forEach(animation => animation?.cancel())
      document.removeEventListener('visibilitychange', syncPlayback)
      motionPreference.removeEventListener('change', syncPlayback)
      syncPlaybackRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    syncPlaybackRef.current()
  }, [active])

  return (
    <div
      aria-labelledby="launch-intro-title"
      aria-modal="true"
      className="launch-intro"
      data-active={active}
      ref={introRef}
      role="dialog"
    >
      <div className="launch-intro-noise" aria-hidden="true" />
      <div className="launch-intro-fluid launch-intro-fluid-cyan" aria-hidden="true" />
      <div className="launch-intro-fluid launch-intro-fluid-violet" aria-hidden="true" />
      <div className="launch-intro-fluid launch-intro-fluid-lime" aria-hidden="true" />
      <div className="launch-intro-orbit launch-intro-orbit-one" aria-hidden="true">
        <span className="launch-intro-planet launch-intro-planet-one" ref={firstPlanetRef} />
      </div>
      <div className="launch-intro-orbit launch-intro-orbit-two" aria-hidden="true">
        <span className="launch-intro-planet launch-intro-planet-two" ref={secondPlanetRef} />
      </div>
      <div className="launch-intro-core" aria-hidden="true">
        <span />
      </div>

      <div className="launch-intro-content">
        <div className="launch-intro-topline">
          <span className="launch-intro-index">00 / 01</span>
          <span className="launch-intro-status"><i /> SYSTEM ONLINE</span>
        </div>
        <p className="launch-intro-kicker">PERSONAL WEBSITE</p>
        <h1 id="launch-intro-title">Jordnary</h1>
        <p aria-label="AI · CS · Web · Explorer" className="launch-intro-description">
          {'AI · CS · Web · Explorer'.split('').map((character, index) => (
            <span aria-hidden="true" key={`${character}-${index}`}>{character}</span>
          ))}
        </p>
        <button className="launch-intro-enter" onClick={onEnter} type="button">
          <span className="launch-intro-enter-label">PRESS ENTER</span>
          <span className="launch-intro-enter-key">↵</span>
        </button>
      </div>

      <div className="launch-intro-footer">
        <a aria-label="打开 GitHub" className="launch-intro-github" href="https://github.com/jordnary">⌁</a>
        <button
          aria-label="向下滚动，进入个人目录"
          className="launch-intro-scroll"
          onClick={onEnter}
          type="button"
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="m5 8 7 7 7-7" />
          </svg>
        </button>
        <span className="launch-intro-coordinates">JORDNARY / ONLINE</span>
      </div>
    </div>
  )
}

function orbitKeyframes(width: number, height: number): Keyframe[] {
  let distance = 0
  const points = Array.from({ length: 121 }, (_, index) => {
    const angle = index / 120 * Math.PI * 2
    return { x: width / 2 * (1 + Math.cos(angle)), y: height / 2 * (1 + Math.sin(angle)), distance: 0 }
  })
  points.forEach((point, index) => {
    if (index > 0) distance += Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y)
    point.distance = distance
  })
  // Arc-length offsets preserve a constant orbital speed on an ellipse.
  return points.map((point, index) => ({
    offset: distance ? point.distance / distance : index / 120,
    transform: `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`,
  }))
}
