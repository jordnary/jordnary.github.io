import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchEvent, type TransitionEvent } from 'react'
import { homepageTransitionTiming, type HomepageTransitionPhase } from '../lib/homepage-transition'
import { HomepageHub } from './HomepageHub'
import { LaunchIntro } from './LaunchIntro'
import { TransitionWipeOverlay } from './TransitionWipeOverlay'

export function HomepagePortal() {
  const [phase, setPhase] = useState<HomepageTransitionPhase>('intro')
  const [hubRevealed, setHubRevealed] = useState(false)
  const hasEntered = useRef(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ identifier: number; x: number; y: number } | null>(null)

  const enter = useCallback(() => {
    if (hasEntered.current) return
    hasEntered.current = true
    // Establish the initial position even when input arrives before the first paint.
    trackRef.current?.getBoundingClientRect()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) setHubRevealed(true)
    setPhase(reducedMotion ? 'hub' : 'pushing')
  }, [])

  useEffect(() => {
    document.body.classList.add('homepage-portal-active')
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionChange = () => {
      if (motionPreference.matches && hasEntered.current) {
        setHubRevealed(true)
        setPhase('hub')
      }
    }
    motionPreference.addEventListener('change', handleMotionChange)
    return () => {
      document.body.classList.remove('homepage-portal-active')
      motionPreference.removeEventListener('change', handleMotionChange)
    }
  }, [])

  useEffect(() => {
    if (phase === 'hub') {
      hubRef.current?.focus({ preventScroll: true })
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Enter on a focused link should retain its normal navigation behavior.
      if (event.target instanceof Element && event.target.closest('a')) return
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        enter()
      }
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY > 1) enter()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [enter, phase])

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    // Adding another finger invalidates the gesture until all fingers lift.
    touchStart.current = phase === 'intro' && event.touches.length === 1
      ? { identifier: touch.identifier, x: touch.clientX, y: touch.clientY }
      : null
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    touchStart.current = null
    const touch = event.changedTouches[0]
    if (!start || event.touches.length !== 0 || touch?.identifier !== start.identifier) return

    const deltaX = touch.clientX - start.x
    const deltaY = start.y - touch.clientY
    // Require a deliberate, mostly vertical upward swipe rather than tap jitter.
    if (deltaY >= 50 && deltaY > Math.abs(deltaX)) enter()
  }

  const handlePushEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === 'transform' && phase === 'pushing') {
      // The hub is already in place behind the wave. Start its staggered
      // reveal as soon as the wave begins shrinking away.
      setHubRevealed(true)
      setPhase('settling')
    }
  }

  const style = {
    '--portal-push-duration': `${homepageTransitionTiming.pushDurationMs}ms`,
    '--portal-wave-push-duration': `${homepageTransitionTiming.pushDurationMs}ms`,
    '--portal-wave-exit-duration': `${homepageTransitionTiming.waveExitDurationMs}ms`,
    '--portal-push-easing': homepageTransitionTiming.easing,
  } as CSSProperties

  return (
    <div className="homepage-portal" data-phase={phase} style={style}>
      {/* Both screens share one transform. Their common edge cannot drift apart. */}
      <div className="homepage-portal-track" onTransitionEnd={handlePushEnd} ref={trackRef}>
        {phase !== 'hub' && (
          <div
            className="homepage-portal-intro"
            inert={phase !== 'intro'}
            onTouchCancel={() => { touchStart.current = null }}
            onTouchEnd={handleTouchEnd}
            onTouchStart={handleTouchStart}
          >
            <LaunchIntro onEnter={enter} />
          </div>
        )}
        <div className="homepage-portal-hub" inert={phase !== 'hub'} ref={hubRef} tabIndex={-1}>
          <HomepageHub active={phase !== 'intro'} revealed={hubRevealed} />
        </div>
      </div>
      {phase !== 'hub' && (
        <div className="homepage-portal-wave">
          <TransitionWipeOverlay onComplete={() => setPhase('hub')} phase={phase} />
        </div>
      )}
    </div>
  )
}
