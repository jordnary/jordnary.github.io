// Shared contours for the torn edges of the page sections.
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
