import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const settle = page => page.waitForFunction(() => {
  const slide = document.querySelector('.yarl__slide_current')
  const stage = document.querySelector('.gallery-stage')
  const image = slide?.querySelector('img')
  return image?.complete && !image.classList.contains('gallery-preview') && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) > 0
    && Math.abs(slide.getBoundingClientRect().x - stage.getBoundingClientRect().x) < 0.1
    && !document.querySelector('.yarl__carousel').getAnimations().some(animation => animation.playState === 'running' || animation.pending)
    && stage.querySelectorAll('.yarl__slide img').length <= 3
    && [...document.querySelectorAll('.gallery-edge-glow')].every(light => Number(getComputedStyle(light).opacity) === 0)
})

async function select(page, index) {
  const label = `第 ${index} 张，共 7 张`
  // Seed either boundary even when its thumbnail lies outside the clipped strip.
  await page.getByRole('button', { name: label }).evaluate(button => button.click())
  await page.waitForFunction(label => document.querySelector('.yarl__thumbnails_thumbnail[aria-current="true"]')?.getAttribute('aria-label') === label, label)
  await settle(page)
}

const sample = page => page.evaluate(() => {
  const slide = document.querySelector('.yarl__slide_current')
  const stage = document.querySelector('.gallery-stage')
  return {
    x: slide.getBoundingClientRect().x - stage.getBoundingClientRect().x,
    imageX: slide.querySelector('img').getBoundingClientRect().x,
    lights: [...stage.querySelectorAll('.gallery-edge-glow')].map(light => Number(getComputedStyle(light).opacity)),
    selected: document.querySelector('.yarl__thumbnails_thumbnail[aria-current="true"]').getAttribute('aria-label'),
    zoom: document.querySelector('.gallery-zoom-reset').textContent,
  }
})

async function touch(session, type, points = []) {
  await session.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 2, radiusY: 2 })),
  })
}

async function move(session, from, to, steps = 6) {
  for (let step = 1; step <= steps; step++) {
    await touch(session, 'touchMove', [[from[0] + (to[0] - from[0]) * step / steps, from[1] + (to[1] - from[1]) * step / steps]])
  }
}

const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

async function probe(page) {
  await page.evaluate(() => {
    const stage = document.querySelector('.gallery-stage')
    const slide = document.querySelector('.yarl__slide_current')
    const lights = [...stage.querySelectorAll('.gallery-edge-glow')]
    const probe = window.galleryBoundaryProbe = { frames: [], tasks: [], frame: 0 }
    probe.observer = new PerformanceObserver(list => probe.tasks.push(...list.getEntries().map(entry => entry.duration)))
    probe.observer.observe({ type: 'longtask' })
    const tick = time => {
      const bounds = slide.querySelector('img').getBoundingClientRect()
      probe.frames.push({ time, x: slide.getBoundingClientRect().x - stage.getBoundingClientRect().x,
        lights: lights.map(light => Number(getComputedStyle(light).opacity)), visible: bounds.right > 0 && bounds.left < innerWidth })
      probe.frame = requestAnimationFrame(tick)
    }
    probe.frame = requestAnimationFrame(tick)
  })
}

async function finishProbe(page) {
  return page.evaluate(() => {
    const probe = window.galleryBoundaryProbe
    cancelAnimationFrame(probe.frame)
    probe.observer.disconnect()
    return { frames: probe.frames, tasks: probe.tasks }
  })
}

async function checkEdge(page, session, direction, report) {
  const bounds = await page.locator('.gallery-stage').boundingBox()
  const y = bounds.y + bounds.height / 2
  const start = [direction === 1 ? 50 : bounds.width - 50, y]
  const origin = await sample(page)
  const distances = [60, 120, 180, 240]
  const positions = []
  let previous = start
  await session.send('Performance.enable')
  const before = (await session.send('Performance.getMetrics')).metrics
  await probe(page)
  await touch(session, 'touchStart', [start])
  for (const distance of distances) {
    const next = [start[0] + direction * distance, y]
    await move(session, previous, next)
    await painted(page)
    const state = await sample(page)
    const displacement = direction * state.x
    assert.ok(displacement > 0 && displacement < distance * 0.5, `The image moves outward with substantial resistance (direction ${direction}, finger ${distance}, image ${displacement}, ${state.selected})`)
    assert.ok(displacement < bounds.width * 0.2 && displacement < 80, 'The image stays close to its resting position')
    assert.equal(state.selected, origin.selected, 'Pulling an edge never wraps the gallery')
    assert.equal(state.lights[direction === 1 ? 1 : 0], 0, 'Only the exhausted edge lights up')
    assert.ok(Math.abs(state.imageX - origin.imageX - state.x) < 0.1, 'The displayed image moves with the resisted slide')
    positions.push({ displacement, glow: state.lights[direction === 1 ? 0 : 1] })
    previous = next
  }
  for (let index = 1; index < positions.length; index++) {
    assert.ok(positions[index].displacement > positions[index - 1].displacement)
    assert.ok(positions[index].glow > positions[index - 1].glow)
    if (index > 1) assert.ok(positions[index].displacement - positions[index - 1].displacement
      < positions[index - 1].displacement - positions[index - 2].displacement, 'Equal finger travel moves the image progressively less')
  }
  if (process.env.PROJECTS_CAPTURE === '1') {
    await mkdir('node_modules/.cache/gallery-preview', { recursive: true })
    await page.screenshot({ path: `node_modules/.cache/gallery-preview/boundary-${direction === 1 ? 'first' : 'last'}-${bounds.width}.png` })
  }
  const dragging = await finishProbe(page)
  assert.ok(dragging.frames.every(frame => frame.visible), 'The image stays visible throughout the drag')
  await probe(page)
  await touch(session, 'touchEnd')
  await settle(page)
  const returning = await finishProbe(page)
  assert.ok(returning.frames.filter(frame => Math.abs(frame.x) > 0.1).length > 8, 'Return motion spans multiple rendered frames')
  for (let index = 1; index < returning.frames.length; index++) {
    assert.ok(direction * returning.frames[index].x >= -0.1, 'The return never overshoots')
    assert.ok(Math.abs(returning.frames[index].x) <= Math.abs(returning.frames[index - 1].x) + 0.1, 'The return is continuous and monotonic')
  }
  const lightIndex = direction === 1 ? 0 : 1
  const ratio = positions.at(-1).glow / positions.at(-1).displacement
  for (const frame of [...dragging.frames, ...returning.frames]) {
    assert.ok(Math.abs(frame.lights[lightIndex] - Math.abs(frame.x) * ratio) < 0.002, 'Light intensity and image displacement stay in sync on every frame')
  }
  const after = (await session.send('Performance.getMetrics')).metrics
  const metric = (values, name) => values.find(metric => metric.name === name)?.value ?? 0
  assert.equal(metric(after, 'LayoutCount') - metric(before, 'LayoutCount'), 0, 'Dragging and returning trigger no layout work')
  const intervals = [...dragging.frames, ...returning.frames].flatMap((frame, index, all) => index ? [frame.time - all[index - 1].time] : [])
    .filter(value => value > 0).sort((a, b) => a - b)
  const p95 = intervals[Math.floor(intervals.length * 0.95)]
  assert.ok(p95 < 50, 'At least 95% of animation frames arrive within 50 ms')
  assert.equal(dragging.tasks.length + returning.tasks.length, 0, 'The gesture introduces no long tasks')
  report(`${direction === 1 ? 'First' : 'Last'} edge: progressive resistance, synchronized light, smooth return; p95 ${p95.toFixed(1)} ms, no layouts or long tasks`)
  return { start, y }
}

export async function runGalleryBoundaryChecks(browser, baseURL, report = () => {}) {
  const errors = []
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'no-preference' })
    try {
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(new URL('projects/vae-gan-digits/', baseURL).href)
      await page.locator('.project-reader-cover .project-reader-image-trigger').tap()
      await settle(page)
      // Keep the independent edge drag outside the opening tap's double-tap window.
      await page.waitForTimeout(350)
      const session = await context.newCDPSession(page)
      const cpuRate = Number(process.env.PROJECTS_CPU_THROTTLE || 1)
      if (cpuRate > 1) await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
      report(`Mobile viewport ${viewport.width} x ${viewport.height}, CPU slowdown ${cpuRate}x`)
      const { y } = await checkEdge(page, session, 1, report)
      await select(page, 7)
      await checkEdge(page, session, -1, report)
      await select(page, 1)

      // Reverse within the pull, then cross the origin into ordinary navigation.
      await touch(session, 'touchStart', [[160, y]])
      await move(session, [160, y], [310, y])
      await painted(page)
      const far = await sample(page)
      await move(session, [310, y], [230, y])
      await painted(page)
      const near = await sample(page)
      assert.ok(near.x > 0 && near.x < far.x && near.lights[0] < far.lights[0], 'Reversing the finger unwinds resistance and light immediately')
      await move(session, [230, y], [20, y], 12)
      await touch(session, 'touchEnd')
      await settle(page)
      assert.equal((await sample(page)).selected, '第 2 张，共 7 张', 'Crossing the origin hands back ordinary image navigation')
      report('Reversing an edge pull dims the light and can continue into a normal image swipe')

      await select(page, 1)
      await touch(session, 'touchStart', [[60, y]])
      await move(session, [60, y], [300, y], 24)
      await touch(session, 'touchEnd')
      await page.waitForTimeout(60)
      await touch(session, 'touchStart', [[180, y]])
      await painted(page)
      const caught = await sample(page)
      assert.ok(caught.x > 1, 'A new drag catches the visible return before it reaches rest')
      await page.waitForTimeout(80)
      assert.ok(Math.abs((await sample(page)).x - caught.x) < 0.1, 'Re-grabbing holds the current position without snapping')
      await move(session, [180, y], [240, y])
      await painted(page)
      assert.ok((await sample(page)).x > caught.x, 'A re-grab continues pulling from the displayed position')
      await touch(session, 'touchCancel')
      await settle(page)
      report('A return can be caught and dragged again; cancellation clears every visual offset')

      await page.waitForTimeout(350)
      await touch(session, 'touchStart', [[60, y]])
      await move(session, [60, y], [200, y])
      await touch(session, 'touchStart', [[200, y], [280, y]])
      await painted(page)
      assert.ok(Math.abs((await sample(page)).x) < 0.1)
      assert.deepEqual((await sample(page)).lights, [0, 0])
      await touch(session, 'touchMove', [[40, y], [350, y]])
      await page.waitForFunction(() => parseInt(document.querySelector('.gallery-zoom-reset').textContent) > 100)
      await touch(session, 'touchEnd')
      await page.getByRole('button', { name: '重置图片缩放' }).tap()
      await page.waitForFunction(() => document.querySelector('.gallery-zoom-reset').textContent === '100%')
      report('Adding a second finger clears boundary motion and hands the gesture to pinch zoom')

      await page.waitForTimeout(350)
      await touch(session, 'touchStart', [[60, y]])
      await move(session, [60, y], [240, y])
      await page.setViewportSize({ width: viewport.width + 12, height: viewport.height })
      await touch(session, 'touchCancel')
      await settle(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await painted(page)
      await touch(session, 'touchStart', [[60, y]])
      await move(session, [60, y], [240, y])
      await painted(page)
      const reduced = await sample(page)
      assert.ok(Math.abs(reduced.x) < 0.1, 'Reduced motion keeps the image still')
      assert.ok(reduced.lights[0] > 0.3, `Reduced motion preserves the positional boundary hint (${JSON.stringify(reduced)})`)
      await touch(session, 'touchEnd')
      await settle(page)
      report('Viewport changes clear the gesture; reduced motion retains feedback without image animation')

      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.waitForTimeout(350)
      await page.touchscreen.tap(195, y)
      await page.waitForTimeout(70)
      await page.touchscreen.tap(195, y)
      await page.waitForFunction(() => parseInt(document.querySelector('.gallery-zoom-reset').textContent) > 100)
      await page.getByRole('button', { name: '重置图片缩放' }).tap()
      await page.waitForFunction(() => document.querySelector('.gallery-zoom-reset').textContent === '100%')
      report('Deliberate double-tap zoom works again after the boundary gesture ends')

      await page.getByRole('button', { name: '关闭图片预览' }).tap()
      await page.goto(new URL('projects/briefing-atlas/', baseURL).href)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.locator('.project-reader-cover .project-reader-image-trigger').tap()
      await settle(page)
      assert.equal(await page.locator('.gallery-edge-glow').count(), 0, 'Single-image galleries do not render boundary effects')
      const stage = await page.locator('.gallery-stage').boundingBox()
      for (const direction of [1, -1]) {
        const start = [direction === 1 ? 60 : 300, stage.y + stage.height / 2]
        await page.waitForTimeout(350)
        await touch(session, 'touchStart', [start])
        await move(session, start, [start[0] + direction * 220, start[1]])
        await painted(page)
        assert.ok(Math.abs((await sample(page)).x) < 0.1, 'A single image stays still when swiping either edge')
        await touch(session, 'touchEnd')
      }
      report('Single-image galleries show neither resisted movement nor edge light in either direction')
    } finally { await context.close() }
  }
  assert.deepEqual(errors, [], 'Boundary gestures produce no browser errors')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runGalleryBoundaryChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Gallery boundary checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
