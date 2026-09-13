/**
 * SVG path pair from SimonAKing/HomePage, used by the homepage push transition.
 * Both paths keep the same command topology for numeric interpolation.
 */
export const homepageTransitionPaths = {
  intro: 'M -44,-50 C -52.71,28.52 15.86,8.186 184,14.69 383.3,22.39 462.5,12.58 638,14 835.5,15.6 987,6.4 1194,13.86 1661,30.68 1652,-36.74 1582,-140.1 1512,-243.5 15.88,-589.5 -44,-50 Z',
  expanded: 'M -44,-50 C -137.1,117.4 67.86,445.5 236,452 435.3,459.7 500.5,242.6 676,244 873.5,245.6 957,522.4 1154,594 1593,753.7 1793,226.3 1582,-126 1371,-478.3 219.8,-524.2 -44,-50 Z',
} as const

export type HomepageTransitionPhase = 'intro' | 'pushing' | 'settling' | 'hub'

export const homepageTransitionTiming = {
  // Give the wave enough time to travel with the two-screen push so its
  // expansion reads as one continuous transition instead of a quick wipe.
  pushDurationMs: 1650,
  shapeScale: [0.8, 1.8, 1] as const,
  shapeScaleSplitMs: 700,
  // The hub is already in place when settling starts; keep only a short
  // tail so the wave is essentially gone as the second screen settles.
  waveExitDurationMs: 320,
  waveExitScale: 0.72,
  easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
  viewBox: '0 0 1440 800',
} as const
