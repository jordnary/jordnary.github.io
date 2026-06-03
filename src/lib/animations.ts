export const viewportOnce = {
  amount: 0.24,
  once: true,
} as const

export const fadeUpHidden = {
  opacity: 0,
  y: 28,
} as const

export const fadeUpVisible = {
  opacity: 1,
  y: 0,
} as const

export function getRevealTransition(index = 0, baseDelay = 0) {
  return {
    delay: baseDelay + index * 0.08,
    duration: 0.55,
    ease: 'easeOut',
  } as const
}
