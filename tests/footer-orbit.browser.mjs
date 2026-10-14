import assert from 'node:assert/strict'

export async function runFooterOrbitChecks(page, report) {
  const frames = await page.evaluate(async () => {
    const paths = [...document.querySelectorAll('[data-footer-orbit]')]
    const visible = document.querySelector('.footer-orbit')
    const samples = []
    const start = performance.now()
    while (performance.now() - start < 7500) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const path = visible.getAttribute('d')
      const [outer, inner] = path.split('Z')
      const coordinates = inner.match(/-?\d+(?:\.\d+)?/g).map(Number)
      const points = Array.from({ length: coordinates.length / 2 }, (_, index) => [coordinates[index * 2], coordinates[index * 2 + 1]])
      const corners = points.filter(([x, y], index) => {
        const before = points[(index + points.length - 1) % points.length]
        const after = points[(index + 1) % points.length]
        const ax = x - before[0], ay = y - before[1]
        const bx = after[0] - x, by = after[1] - y
        return Math.abs(ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by)) > 0.02
      }).length
      samples.push({
        time: performance.now() - start, path, outer, points, corners,
        angle: Math.atan2(points[0][1], points[0][0]),
        synchronized: paths.length === 2 && paths.every(element => element.getAttribute('d') === path),
      })
    }
    return samples
  })
  assert.ok(frames.every(frame => frame.synchronized), 'The visible polygon and ink mask match on every frame')
  assert.ok(frames.every(frame => frame.outer === frames[0].outer), 'Only the inner polygon changes; the outer ring stays steady')
  const runs = []
  for (const frame of frames) {
    const previous = runs.at(-1)
    if (previous?.path === frame.path) previous.end = frame.time
    else runs.push({ ...frame, end: frame.time })
  }
  const holds = runs.filter(run => run.end - run.time >= 180)
  assert.deepEqual([...new Set(holds.map(hold => hold.corners))].sort((a, b) => a - b), [4, 5, 6, 7, 8, 9, 10], 'Each polygon from four to ten sides has a clearly visible pause')
  assert.ok(holds.length >= 7 && holds.every(hold => hold.end - hold.time <= 500), 'Shape and rotation rest together for roughly 420ms per beat')
  for (let index = 1; index < holds.length; index++) {
    const between = frames.filter(frame => frame.time > holds[index - 1].end && frame.time < holds[index].time)
    assert.ok(between.length >= 8, 'Each step morphs through intermediate shapes instead of swapping polygons')
    assert.ok(new Set(between.map(frame => frame.angle.toFixed(2))).size >= 6, 'Rotation advances during the same interval as the shape change')
    const maximumCorners = Math.max(holds[index - 1].corners, holds[index].corners)
    assert.ok(between.every(frame => frame.corners <= maximumCorners), 'A new corner grows from one edge without intermediate extra facets')
  }
  // Nearest-boundary distances also cover the ten-to-four loop seam, whose
  // equivalent square can use a different first vertex without a visual jump.
  const distanceToEdge = (point, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const mix = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(point[0] - a[0] - mix * dx, point[1] - a[1] - mix * dy)
  }
  for (let index = 1; index < frames.length; index++) {
    const before = frames[index - 1], after = frames[index]
    if (after.time - before.time > 35) continue
    assert.ok(after.points.every(point => Math.min(...before.points.map((a, edge) => distanceToEdge(point, a, before.points[(edge + 1) % before.points.length]))) < 10), 'Morphing and loop boundaries stay continuous')
  }
  report('The O cycles through four to ten sides, rotating during each morph and holding still between beats; its ink mask remains synchronized')
}
