import { useEffect, useRef } from 'react'

export function LaunchIntro({ onEnter }: { onEnter: () => void }) {
  const firstPlanetRef = useRef<HTMLSpanElement>(null)
  const secondPlanetRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const firstPlanet = firstPlanetRef.current
    const secondPlanet = secondPlanetRef.current
    if (!firstPlanet || !secondPlanet || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const speeds = [1 / 9000, -1 / 12000]
    let progress = [0.12, 0.58]
    let lastTime = performance.now()
    let frame = 0

    const animate = (time: number) => {
      const delta = Math.min(40, Math.max(0, time - lastTime))
      lastTime = time

      progress = progress.map((value, index) => (value + speeds[index] * delta + 1) % 1)
      firstPlanet.style.setProperty('offset-distance', `${progress[0] * 100}%`)
      secondPlanet.style.setProperty('offset-distance', `${progress[1] * 100}%`)
      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      aria-labelledby="launch-intro-title"
      aria-modal="true"
      className="launch-intro"
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
