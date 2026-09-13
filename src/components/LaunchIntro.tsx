import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TransitionWipeOverlay } from './TransitionWipeOverlay'
import { homepageTransitionEvents } from '../lib/homepage-transition'

export function LaunchIntro() {
  const [isClosing, setIsClosing] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const introRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const isClosingRef = useRef(false)
  const isHiddenRef = useRef(false)
  const hasEnteredRef = useRef(false)

  const enter = useCallback(() => {
    if (isClosingRef.current || isHiddenRef.current) return
    isClosingRef.current = true
    hasEnteredRef.current = true
    window.dispatchEvent(new CustomEvent(homepageTransitionEvents.start))
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      isHiddenRef.current = true
      isClosingRef.current = false
      setIsHidden(true)
      setIsClosing(false)
      window.dispatchEvent(new CustomEvent(homepageTransitionEvents.complete))
      closeTimerRef.current = null
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1100)
  }, [])

  useEffect(() => {
    if (isHidden) {
      document.body.classList.remove('launch-intro-active')
      document.getElementById('directory')?.scrollIntoView({ behavior: 'auto', block: 'start' })
      return
    }

    if (!hasEnteredRef.current) document.body.classList.add('launch-intro-active')

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        enter()
      }
    }

    const handleWheel = (event: WheelEvent) => { if (event.deltaY > 1) enter() }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: true })

    return () => {
      document.body.classList.remove('launch-intro-active')
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [enter, isHidden])

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = introRef.current?.getBoundingClientRect()
    const intro = introRef.current
    if (!rect || !intro) return
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    intro.style.setProperty('--launch-x', `${x}%`)
    intro.style.setProperty('--launch-y', `${y}%`)
  }

  const phase = isHidden ? 'hub' : (isClosing ? 'entering' : 'intro')

  return (
    <>
      <TransitionWipeOverlay active={isClosing} />
      <div
        aria-hidden={isHidden || undefined}
        aria-label="Jordnary 启动页"
        aria-labelledby="launch-intro-title"
        aria-modal="true"
        className={`launch-intro${isClosing ? ' is-closing' : ''}${isHidden ? ' is-hidden' : ''}`}
        data-phase={phase}
        onPointerMove={handlePointerMove}
        ref={introRef}
        role="dialog"
      >
      <div className="launch-intro-noise" aria-hidden="true" />
      <div className="launch-intro-fluid launch-intro-fluid-cyan" aria-hidden="true" />
      <div className="launch-intro-fluid launch-intro-fluid-violet" aria-hidden="true" />
      <div className="launch-intro-fluid launch-intro-fluid-lime" aria-hidden="true" />
      <div className="launch-intro-orbit launch-intro-orbit-one" aria-hidden="true" />
      <div className="launch-intro-orbit launch-intro-orbit-two" aria-hidden="true" />
      <div className="launch-intro-core" aria-hidden="true">
        <span />
      </div>

      <div className="launch-intro-content">
        <div className="launch-intro-topline">
          <span className="launch-intro-index">00 / 01</span>
          <span className="launch-intro-status"><i /> SYSTEM ONLINE</span>
        </div>
        <p className="launch-intro-kicker">PERSONAL WEBSITE / 2026</p>
        <h1 id="launch-intro-title">Jordnary</h1>
        <p aria-label="AI · CS · Web · Explorer" className="launch-intro-description">
          {'AI · CS · Web · Explorer'.split('').map((character, index) => (
            <span aria-hidden="true" key={`${character}-${index}`}>{character}</span>
          ))}
        </p>
        <button className="launch-intro-enter" onClick={enter} type="button">
          <span className="launch-intro-enter-label">PRESS ENTER</span>
          <span className="launch-intro-enter-key">↵</span>
        </button>
      </div>

      <div className="launch-intro-footer">
        <a aria-label="打开 GitHub" className="launch-intro-github" href="https://github.com/jordnary">⌁</a>
        <button
          aria-label="向下滚动，进入个人目录"
          className="launch-intro-scroll"
          onClick={enter}
          type="button"
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="m5 8 7 7 7-7" />
          </svg>
        </button>
        <span className="launch-intro-coordinates">JORDNARY / ONLINE</span>
      </div>
      </div>
    </>
  )
}
