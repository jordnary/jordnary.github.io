import { useCallback, useEffect, useRef, useState, type CSSProperties, type TransitionEvent } from 'react'
import { homepageTransitionTiming, type HomepageTransitionPhase } from '../lib/homepage-transition'
import { HomepageHub } from './HomepageHub'
import { LaunchIntro } from './LaunchIntro'
import { TransitionWipeOverlay } from './TransitionWipeOverlay'

export function HomepagePortal() {
  const [phase, setPhase] = useState<HomepageTransitionPhase>('intro')
  const hasEntered = useRef(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)

  const enter = useCallback(() => {
    if (hasEntered.current) return
    hasEntered.current = true
    // Establish the initial position even when input arrives before the first paint.
    trackRef.current?.getBoundingClientRect()
    setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'hub' : 'pushing')
  }, [])

  useEffect(() => {
    document.body.classList.add('homepage-portal-active')
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionChange = () => {
      if (motionPreference.matches && hasEntered.current) setPhase('hub')
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

  const handlePushEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === 'transform' && phase === 'pushing') {
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
          <div className="homepage-portal-intro" inert={phase !== 'intro'}>
            <LaunchIntro onEnter={enter} />
          </div>
        )}
        <div className="homepage-portal-hub" inert={phase !== 'hub'} ref={hubRef} tabIndex={-1}>
          <HomepageHub active={phase !== 'intro'} />
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
