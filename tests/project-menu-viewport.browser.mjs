import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const trigger = page => page.getByRole('button', { name: 'Open menu', exact: true })
const frames = (page, count = 3) => page.evaluate(count => new Promise(resolve => {
  const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick)
  requestAnimationFrame(tick)
}), count)
const settled = page => page.waitForFunction(() => {
  const button = document.querySelector('button[aria-label="Open menu"]')
  const viewport = visualViewport
  return Math.abs(button.getBoundingClientRect().bottom - (viewport.offsetTop + viewport.height - 24)) < .1
})
const startProbe = page => page.evaluate(() => {
  const probe = window.menuViewportProbe = { samples: [], frame: 0 }
  const sample = () => {
    const button = document.querySelector('button[aria-label="Open menu"]')
    const rect = button.getBoundingClientRect()
    probe.samples.push({ y: rect.y, bottom: rect.bottom, height: innerHeight, scroll: scrollY,
      body: document.querySelector('.project-reader-scroll').scrollTop })
    probe.frame = requestAnimationFrame(sample)
  }
  sample()
})
const stopProbe = page => page.evaluate(() => {
  cancelAnimationFrame(window.menuViewportProbe.frame)
  return window.menuViewportProbe.samples
})

export async function runProjectMenuViewportChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(new URL('projects/triton-attention-optimization/#project-sparsity', baseURL).href)
    await trigger(page).waitFor()
    await page.evaluate(() => document.fonts.ready)
    await settled(page)
    assert.equal(await trigger(page).getAttribute('data-viewport-anchor'), 'true')
    const session = await context.newCDPSession(page)
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }))
    await frames(page)
    await startProbe(page)
    for (const [start, end] of [[550, 250], [250, 550]]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 380, y: start, id: 0 }] })
      for (let step = 1; step <= 12; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 380, y: start + (end - start) * step / 12, id: 0 }] })
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await frames(page, 10)
    }
    const scrolling = await stopProbe(page)
    assert.ok(scrolling.length > 20)
    assert.ok(scrolling.every(sample => Math.abs(sample.bottom - (sample.height - 24)) < .1), 'Ordinary touch scrolling does not move the menu independently')
    assert.ok(new Set(scrolling.map(sample => sample.scroll)).size > 1 || new Set(scrolling.map(sample => sample.body)).size > 1)
    report('Native touch scrolling preserves the menu position while page or article content moves')

    for (const height of [780, 844]) {
      const before = await trigger(page).boundingBox()
      await startProbe(page)
      await page.setViewportSize({ width: 390, height })
      await settled(page)
      const samples = await stopProbe(page)
      const after = await trigger(page).boundingBox()
      const direction = Math.sign(after.y - before.y)
      const distance = Math.abs(after.y - before.y)
      assert.ok(distance > 40)
      assert.ok(new Set(samples.map(sample => sample.y.toFixed(2))).size >= 8, 'A discrete viewport update produces multiple intermediate positions')
      for (let index = 1; index < samples.length; index++) {
        const delta = samples[index].y - samples[index - 1].y
        assert.ok(delta * direction >= -.1, 'The menu approaches the new edge without reversing or jittering')
        assert.ok(Math.abs(delta) < distance * .8, 'Containment leaves a smooth approach instead of jumping the complete viewport step')
      }
      assert.ok(samples.every(sample => sample.y >= 0 && sample.bottom <= sample.height - 3.9), 'Viewport changes never carry the menu outside the screen')
      report(`Viewport height ${height}px: continuous monotonic motion settles at the correct bottom inset`)
    }

    await page.setViewportSize({ width: 390, height: 780 })
    await frames(page, 2)
    await page.setViewportSize({ width: 390, height: 820 })
    await settled(page)
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 16 })
      visualViewport.dispatchEvent(new Event('scroll'))
    })
    await settled(page)
    await page.evaluate(() => {
      delete visualViewport.offsetTop
      visualViewport.dispatchEvent(new Event('scroll'))
    })
    await settled(page)
    report('Reversing a viewport resize and changing its visible offset retarget the current motion correctly')

    await page.setViewportSize({ width: 844, height: 390 })
    await frames(page, 2)
    assert.ok(await trigger(page).evaluate(button => Math.abs(innerHeight - button.getBoundingClientRect().bottom - 24) < .1), 'Rotation snaps directly to the new screen edge')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 844, height: 350 })
    await frames(page, 2)
    assert.ok(await trigger(page).evaluate(button => Math.abs(innerHeight - button.getBoundingClientRect().bottom - 24) < .1), 'Reduced motion changes position without interpolation')
    await trigger(page).tap()
    await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'open')
    await page.getByRole('button', { name: 'Close menu', exact: true }).tap()
    await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'closed')
    assert.ok(await trigger(page).evaluate(button => button === document.activeElement))
    report('Landscape, reduced motion, menu activation and focus restoration remain correct')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runProjectMenuViewportChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Project menu viewport checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
