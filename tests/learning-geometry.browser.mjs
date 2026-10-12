import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const geometrySelector = '#skills .learning-geometry, #timeline .learning-geometry'

async function sampleDrawing(svg) {
  return svg.evaluate(async element => {
    const paths = [...element.querySelectorAll('path.geometry-draw')]
    const animations = element.getAnimations({ subtree: true })
    const drawing = animations.filter(animation => animation.animationName === 'learning-wire-build')
    const guides = animations.filter(animation => animation.animationName === 'learning-guide-reveal')
    const construction = [...drawing, ...guides]
    const flows = animations.filter(animation => animation.animationName === 'learning-guide-flow')
    const timings = construction.map(animation => animation.effect.getTiming())
    const finite = timings.every(timing => Number.isFinite(timing.iterations) && timing.iterations === 1)
    if (!drawing.length || !finite) return { drawing: drawing.length, guides: guides.length, finite }
    const end = Math.max(...timings.map(timing => timing.delay + Number(timing.duration) * timing.iterations))
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const offsets = () => paths.map(path => Number.parseFloat(getComputedStyle(path).strokeDashoffset))
    for (const animation of construction) animation.pause()
    for (const animation of construction) animation.currentTime = 0
    await frame()
    const start = offsets()
    for (const animation of construction) animation.currentTime = end * 0.5
    await frame()
    const middle = offsets()
    for (const animation of construction) animation.finish()
    await frame()
    const complete = offsets()
    const finished = construction.every(animation => animation.playState === 'finished')
    const flowTargets = flows.map(animation => animation.effect.target)
    const flowState = () => flowTargets.map(target => ({
      offset: Number.parseFloat(getComputedStyle(target).strokeDashoffset),
      path: target.getAttribute('d'),
      transform: target.getAttribute('transform'),
      computedTransform: getComputedStyle(target).transform,
    }))
    const continuous = flows.length > 0 && flows.every(animation => animation.effect.getTiming().iterations === Infinity)
    for (const animation of flows) {
      animation.pause()
      const timing = animation.effect.getTiming()
      animation.currentTime = timing.delay + Number(timing.duration) * 0.2
    }
    await frame()
    const flowStart = flowState()
    for (const animation of flows) {
      const timing = animation.effect.getTiming()
      animation.currentTime = timing.delay + Number(timing.duration) * 0.7
    }
    await frame()
    const flowLater = flowState()
    await frame()
    return {
      drawing: drawing.length,
      guides: guides.length,
      finite,
      end,
      start,
      middle,
      complete,
      settled: offsets(),
      finished,
      continuous,
      flowStart,
      flowLater,
    }
  })
}

function assertDrawing(sample, label) {
  assert.ok(sample.drawing > 0, `${label} exposes its construction animation`)
  assert.ok(sample.guides > 0, `${label} fades its auxiliary guides into place`)
  assert.equal(sample.finite, true, `${label} constructs its outline and reveals its guides with single finite cycles`)
  assert.ok(Number.isFinite(sample.end) && sample.end > 0, `${label} has a finite completion time`)
  assert.ok(sample.start.every(offset => offset > 0.9), `${label} starts with undrawn normalized paths`)
  assert.ok(sample.middle.some((offset, index) => offset < sample.start[index] - 0.01), `${label} progressively draws its paths`)
  assert.ok(sample.complete.every(offset => Math.abs(offset) < 0.001), `${label} finishes every structural line`)
  assert.equal(sample.finished, true, `${label} stops once its construction is complete`)
  assert.deepEqual(sample.settled, sample.complete, `${label} remains still after completion`)
  assert.equal(sample.continuous, true, `${label} continues moving the internal dash pattern after construction`)
  assert.ok(sample.flowLater.every((state, index) => Math.abs(state.offset - sample.flowStart[index].offset) > 0.01), `${label} advances each internal dash pattern`)
  const shape = ({ path, transform, computedTransform }) => ({ path, transform, computedTransform })
  assert.deepEqual(sample.flowLater.map(shape), sample.flowStart.map(shape), `${label} moves only the dash pattern while preserving each guide's shape and transform`)
}

async function waitForDrawing(svg) {
  await svg.page().waitForFunction(element => element.dataset.visible === 'true'
    && element.querySelector('path.geometry-draw').getAnimations().some(animation => animation.animationName === 'learning-wire-build'), await svg.elementHandle())
}

async function assertStatic(svg, label) {
  const state = await svg.evaluate(element => ({
    animations: element.getAnimations({ subtree: true }).length,
    paths: [...element.querySelectorAll('path.geometry-draw')].map(path => ({
      offset: Number.parseFloat(getComputedStyle(path).strokeDashoffset),
      opacity: Number.parseFloat(getComputedStyle(path).opacity),
    })),
  }))
  assert.equal(state.animations, 0, `${label} has no active or retained animations`)
  assert.ok(state.paths.length > 0 && state.paths.every(path => Math.abs(path.offset) < 0.001 && path.opacity > 0), `${label} keeps the complete structural drawing visible`)
}

export async function runLearningGeometryChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const url = new URL('learning/', baseURL).href
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-desktop', 'true'))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(url)
    const svgs = page.locator(geometrySelector)
    assert.equal(await page.locator('#skills .learning-geometry').count(), 4)
    assert.equal(await page.locator('#timeline .learning-geometry').count(), 3)
    assert.ok(await svgs.evaluateAll(elements => elements.every(element => {
      const paths = [...element.querySelectorAll('path.geometry-draw')]
      return paths.length > 0 && paths.every(path => path.getAttribute('pathLength') === '1'
        && getComputedStyle(path).getPropertyValue('--draw-delay').trim()
        && getComputedStyle(path).getPropertyValue('--draw-duration').trim())
    })), 'All seven covers use normalized paths with their own drawing schedule')
    pass('The knowledge map and stage plan contain seven normalized construction drawings')

    for (let index = 0; index < await svgs.count(); index++) {
      const svg = svgs.nth(index)
      const label = `Cover ${index + 1}`
      await page.mouse.move(0, 0)
      await svg.scrollIntoViewIfNeeded()
      await svg.hover()
      await waitForDrawing(svg)
      const initialAnimation = await svg.evaluateHandle(element => element.querySelector('path.geometry-draw').getAnimations().find(animation => animation.animationName === 'learning-wire-build'))
      assertDrawing(await sampleDrawing(svg), label)
      await page.mouse.move(0, 0)
      await page.waitForFunction(element => element.getAnimations({ subtree: true }).length === 0, await svg.elementHandle())
      await assertStatic(svg, `${label} outside hover`)
      await svg.hover()
      await waitForDrawing(svg)
      assert.equal(await svg.evaluate((element, previous) => element.querySelector('path.geometry-draw').getAnimations().find(animation => animation.animationName === 'learning-wire-build') !== previous, initialAnimation), true, `${label} creates a fresh construction animation when hovered again`)
      assertDrawing(await sampleDrawing(svg), `${label} replay`)
      await initialAnimation.dispose()
    }
    pass('All seven covers construct once per hover, retain flowing internal dashes, restore static idle outlines, and replay on the next hover')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (let index = 0; index < await svgs.count(); index++) {
      const svg = svgs.nth(index)
      await svg.scrollIntoViewIfNeeded()
      await svg.hover()
      await assertStatic(svg, `Reduced-motion cover ${index + 1}`)
    }
    pass('Reduced motion keeps all seven hovered covers complete and still')

    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} theme stays within a ${width}px viewport`)
        assert.ok(await svgs.evaluateAll(elements => elements.every(element => {
          const bounds = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return bounds.width > 0 && bounds.height > 0 && bounds.left >= -1 && bounds.right <= innerWidth + 1
            && style.stroke !== 'none' && style.stroke !== 'transparent'
        })), `${theme} theme retains visible, contained geometry at ${width}px`)
      }
    }
    pass('Both themes retain all seven drawings without horizontal overflow from desktop through 320px layouts')
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await touchContext.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-mobile', 'true'))
  const touch = await touchContext.newPage()
  const touchErrors = []
  touch.on('pageerror', error => touchErrors.push(error.message))
  try {
    await touch.goto(url)
    assert.equal(await touch.evaluate(() => matchMedia('(hover: none)').matches), true)
    const svgs = touch.locator(geometrySelector)
    for (let index = 0; index < await svgs.count(); index++) {
      const svg = svgs.nth(index)
      await svg.scrollIntoViewIfNeeded()
      await waitForDrawing(svg)
      assertDrawing(await sampleDrawing(svg), `Touch cover ${index + 1}`)
    }
    pass('Touch screens construct each visible cover once and continue flowing its internal dash patterns')
    await touch.emulateMedia({ reducedMotion: 'reduce' })
    for (let index = 0; index < await svgs.count(); index++) {
      const svg = svgs.nth(index)
      await svg.scrollIntoViewIfNeeded()
      await assertStatic(svg, `Reduced-motion touch cover ${index + 1}`)
    }
    assert.ok(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.deepEqual(touchErrors, [])
    pass('Reduced-motion touch screens show complete static drawings without overflow or browser errors')
  } finally {
    await touchContext.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runLearningGeometryChecks(browser, process.env.LEARNING_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} learning geometry checks passed`)
  } catch (error) {
    console.error('Learning geometry browser checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
