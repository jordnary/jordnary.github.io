/**
 * SVG path pair used by SimonAKing/HomePage's intro wipe.
 * Both paths intentionally keep the same command topology so they can be
 * interpolated by Motion, Web Animations API, or anime.js.
 */
export const homepageTransitionPaths = {
  intro: 'M -44,-50 C -52.71,28.52 15.86,8.186 184,14.69 383.3,22.39 462.5,12.58 638,14 835.5,15.6 987,6.4 1194,13.86 1661,30.68 1652,-36.74 1582,-140.1 1512,-243.5 15.88,-589.5 -44,-50 Z',
  expanded: 'M -44,-50 C -137.1,117.4 67.86,445.5 236,452 435.3,459.7 500.5,242.6 676,244 873.5,245.6 957,522.4 1154,594 1593,753.7 1793,226.3 1582,-126 1371,-478.3 219.8,-524.2 -44,-50 Z',
} as const

export const homepageTransitionTiming = {
  durationMs: 1100,
  shapeScale: [0.8, 1.8, 1] as const,
  shapeScaleSplitMs: 550,
  contentDelayMs: 400,
  gridDelayMs: 1500,
  shapeTransformOrigin: '50% 0%',
  viewBox: '0 0 1440 800',
} as const

/** Lifecycle events shared by the intro and the second-screen hub. */
export const homepageTransitionEvents = {
  start: 'homepage-transition-start',
  complete: 'homepage-transition-complete',
} as const
