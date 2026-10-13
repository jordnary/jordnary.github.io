import type { AnimationEvent } from 'react'
import { homepageTransitionPath, homepageTransitionTiming } from '../lib/homepage-transition'

export function TransitionWipeOverlay({ onComplete }: { onComplete: () => void }) {
  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.animationName === 'portal-wave-exit') {
      onComplete()
    }
  }

  return (
    <div aria-hidden="true" className="transition-wipe-overlay" onAnimationEnd={handleAnimationEnd}>
      {/* Rasterize one silhouette; animate its layers without rewriting the path. */}
      <div className="transition-wipe-shape">
        <svg preserveAspectRatio="none" viewBox={homepageTransitionTiming.viewBox}>
          <path d={homepageTransitionPath} />
        </svg>
      </div>
    </div>
  )
}
