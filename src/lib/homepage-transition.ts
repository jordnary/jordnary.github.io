/** Asymmetric wave silhouette adapted from SimonAKing/HomePage. */
export const homepageTransitionPath = 'M -44,-50 C -137.1,117.4 67.86,445.5 236,452 435.3,459.7 500.5,242.6 676,244 873.5,245.6 957,522.4 1154,594 1593,753.7 1793,226.3 1582,-126 L 1582,-800 L -44,-800 Z'

export type HomepageTransitionPhase = 'intro' | 'pushing' | 'settling' | 'hub'

export const homepageTransitionTiming = {
  pushDurationMs: 550,
  waveDurationMs: 900,
  revealDelayMs: 400,
  // A watchdog releases input even if a browser drops an animation end event.
  completionGraceMs: 180,
  viewBox: '0 0 1440 800',
} as const
