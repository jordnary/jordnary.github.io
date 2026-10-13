import { useCallback, useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type TouchEvent } from 'react'
import { homepageTransitionTiming, type HomepageTransitionPhase } from '../lib/homepage-transition'
import { HomepageHub } from './HomepageHub'
import { LaunchIntro } from './LaunchIntro'
import { TransitionWipeOverlay } from './TransitionWipeOverlay'

export function HomepagePortal() {
  const [phase, setPhase] = useState<HomepageTransitionPhase>('intro')
  const hasEntered = useRef(false)
  const portalRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ identifier: number; x: number; y: number } | null>(null)

  const enter = useCallback(() => {
    if (hasEntered.current) return
    hasEntered.current = true
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setPhase(reducedMotion ? 'hub' : 'pushing')
  }, [])

  const complete = useCallback(() => {
    setPhase('hub')
  }, [])

  useEffect(() => {
    if (phase !== 'pushing') return
    const intro = portalRef.current?.querySelector('.homepage-portal-intro')
    const cancelPush = afterAnimationTime(intro, 'portal-screen-push', homepageTransitionTiming.pushDurationMs, () => {
      setPhase((current) => current === 'pushing' ? 'settling' : current)
    }, homepageTransitionTiming.pushDurationMs + homepageTransitionTiming.completionGraceMs)
    return cancelPush
  }, [phase])

  useEffect(() => {
    if (phase !== 'settling') return
    return afterAnimationTime(portalRef.current?.querySelector('.transition-wipe-overlay'),
      'portal-wave-exit', homepageTransitionTiming.waveDurationMs, complete, homepageTransitionTiming.waveDurationMs
      - homepageTransitionTiming.pushDurationMs + homepageTransitionTiming.completionGraceMs)
  }, [complete, phase])

  useEffect(() => {
    document.body.classList.add('homepage-portal-active')
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionChange = () => {
      if (motionPreference.matches && hasEntered.current) {
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

  const handlePushEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.animationName === 'portal-screen-push' && phase === 'pushing') {
      setPhase('settling')
    }
  }

  const style = {
    '--portal-push-duration': `${homepageTransitionTiming.pushDurationMs}ms`,
    '--portal-wave-duration': `${homepageTransitionTiming.waveDurationMs}ms`,
    '--portal-reveal-delay': `${homepageTransitionTiming.revealDelayMs}ms`,
  } as CSSProperties

  return (
    <div className="homepage-portal" data-phase={phase} ref={portalRef} style={style}>
      <div className="homepage-portal-track">
        {phase !== 'hub' && (
          <div
            className="homepage-portal-intro"
            inert={phase !== 'intro'}
            onAnimationEnd={handlePushEnd}
            onTouchCancel={() => { touchStart.current = null }}
            onTouchEnd={handleTouchEnd}
            onTouchStart={handleTouchStart}
          >
            <LaunchIntro active={phase === 'intro'} onEnter={enter} />
          </div>
        )}
        <div className="homepage-portal-hub" inert={phase !== 'hub'} ref={hubRef} tabIndex={-1}>
          <HomepageHub active={phase === 'hub'} revealed={phase !== 'intro'} />
        </div>
      </div>
      {phase !== 'hub' && (
        <div className="homepage-portal-wave">
          <TransitionWipeOverlay onComplete={complete} />
        </div>
      )}
    </div>
  )
}

// A cold first paint can start CSS animations later than the input event.
// Check the browser's animation clock so a watchdog never cuts a slow start short.
function afterAnimationTime(element: Element | null | undefined, name: string, time: number,
  callback: () => void, initialDelay = time) {
  let timer = 0
  const check = () => {
    const animation = element?.getAnimations().find(item => 'animationName' in item && item.animationName === name)
    const elapsed = typeof animation?.currentTime === 'number' ? animation.currentTime : 0
    if (animation && elapsed < time) {
      timer = window.setTimeout(check, Math.max(16, time - elapsed))
    } else {
      callback()
    }
  }
  timer = window.setTimeout(check, initialDelay)
  return () => window.clearTimeout(timer)
}
