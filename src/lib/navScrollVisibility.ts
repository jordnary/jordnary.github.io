type ScrollSample = {
  top: number
  now: number
  headerHeight: number
  keepVisible: boolean
  source: 'manual' | 'navigation'
}

const hideDistance = 120
const revealDistance = 8
const maxReadingResistance = 180
const readingPauseMs = 500

export function createNavScrollVisibility(initialTop: number) {
  let previousTop = initialTop
  let downwardStart = initialTop
  let peak = initialTop
  let hidden = false
  let readingResistance = 0
  let lastMovedAt: number | null = null

  return ({ top, now, headerHeight, keepVisible, source }: ScrollSample) => {
    const delta = top - previousTop
    const resumed = lastMovedAt !== null && now - lastMovedAt > readingPauseMs
    const lastTop = previousTop
    previousTop = top
    if (delta !== 0) lastMovedAt = now

    if (source === 'navigation' || keepVisible || top <= headerHeight) {
      hidden = false
      downwardStart = peak = top
      readingResistance = 0
      lastMovedAt = null
      return hidden
    }
    if (delta === 0) return hidden

    // Separate reading adjustments must not add up to a hide gesture.
    if (!hidden && resumed) {
      downwardStart = peak = lastTop
      readingResistance = 0
    }

    // Revisiting text builds resistance; sustained downward travel spends it.
    // This adapts to the reading path, without locking visibility for a duration.
    if (!hidden) readingResistance = Math.max(0, Math.min(maxReadingResistance, readingResistance - (delta > 0 ? delta * 0.5 : delta)))

    peak = Math.max(peak, top)
    if (peak - top >= revealDistance) {
      if (hidden) {
        hidden = false
        readingResistance = Math.min(maxReadingResistance, peak - top)
      }
      // A meaningful reversal cancels downward intent; subpixel noise does not.
      downwardStart = peak = top
    }

    if (!hidden) {
      downwardStart = Math.min(downwardStart, top)
      // Only fresh downward movement can hide, never a timer or an upward event.
      if (delta > 0 && top - downwardStart >= hideDistance + readingResistance) {
        hidden = true
        peak = top
      }
    }
    return hidden
  }
}
