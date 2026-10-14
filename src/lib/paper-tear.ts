// Shared contours keep the visible paper edge and the footer mask aligned.
function tornContour(offset: number, seed: number) {
  let state = seed
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  const points: string[] = []
  for (let x = 0; x < 1440; x += 1.5 + random() * 3.5) {
    const y = offset + Math.sin(x / 73) * 4 + Math.sin(x / 21) * 2.6
      + Math.sin(x / 7.3) * 1.1 + (random() - 0.5) * 2.6
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `M${points.join('L')}L1440 ${offset}V64H0Z`
}

export const paperTear = tornContour(15, 17)
export const surfaceTear = tornContour(37, 41)

export const paperSeamMask = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 64" preserveAspectRatio="none"><path d="${paperTear}" fill="white"/></svg>`,
)}")`
