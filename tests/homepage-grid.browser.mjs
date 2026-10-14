import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runHomepageGridChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  // Observe actual canvas output without exposing game state in the component.
  await context.addInitScript(() => {
    const prototype = CanvasRenderingContext2D.prototype
    const clearRect = prototype.clearRect
    const fillRect = prototype.fillRect
    window.__gridCells = []
    prototype.clearRect = function (...args) {
      if (this.canvas.matches('.homepage-hub-canvas')) window.__gridCells = []
      return clearRect.apply(this, args)
    }
    prototype.fillRect = function (x, y, width, height) {
      if (this.canvas.matches('.homepage-hub-canvas') && width === 40 && height === 40) {
        window.__gridCells.push({ x, y, fill: this.fillStyle, alpha: this.globalAlpha })
      }
      return fillRect.call(this, x, y, width, height)
    }
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const read = async () => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const cells = window.__gridCells
    return {
      green: cells.filter(cell => cell.fill.startsWith('rgba(100, 255, 152,')),
      body: cells.filter(cell => cell.fill === '#e8f0ff'),
      residual: cells.filter(cell => cell.fill === '#dae7ff'),
      head: cells.filter(cell => cell.fill.startsWith('rgba(255, 255, 255,')),
      count: cells.length,
    }
  })
  const fresh = async () => {
    await page.goto(baseURL)
    await page.locator('.launch-intro-enter').waitFor()
  }
  const waitForHub = async () => {
    await page.locator('.homepage-portal[data-phase="hub"]').waitFor()
    await page.waitForFunction(() => document.querySelector('.homepage-hub-canvas').width > 300)
    await page.evaluate(() => document.fonts.ready)
  }
  const enter = async () => { await page.keyboard.press('Enter'); await waitForHub() }
  const expectSimple = async (label, count = 0) => {
    const state = await read()
    assert.equal(state.green.length, 0, `${label}: no green game cell`)
    assert.equal(state.body.length, 0, `${label}: no snake body`)
    assert.equal(state.residual.length, 0, `${label}: no fading trail`)
    assert.equal(state.count, count, `${label}: only the current pointer may be highlighted`)
  }
  const expectDesktop = async label => {
    const state = await read()
    assert.equal(state.green.length, 1, `${label}: green target restored`)
    assert.equal(state.body.length, 1, `${label}: a fresh initial body`)
    assert.equal(state.head.length, 0, `${label}: no stale pointer`)
    assert.equal(state.residual.length, 0, `${label}: no stale trail`)
  }

  try {
    await fresh()
    await enter()
    await expectDesktop('Initial desktop')
    await page.evaluate(() => { window.__originalGrid = document.querySelector('.homepage-hub-canvas') })
    await page.mouse.move(100, 780)
    const target = (await read()).green[0]
    await page.mouse.move(target.x + 20, target.y + 20)
    await page.mouse.move(500, 780)
    const collected = await read()
    assert.equal(collected.green.length, 1, 'Collecting a target spawns another target')
    assert.ok(collected.body.length >= 2, 'Collecting a target grows the white body')
    assert.equal(collected.head.length, 1, 'The pointer head remains visible')
    await page.locator('.homepage-hub').dispatchEvent('pointerleave', { pointerType: 'mouse' })
    assert.equal((await read()).residual.length, 1, 'Leaving the surface creates the fading tail')
    pass('Desktop retains the green target, collection growth, white body, and fading tail')

    for (let cycle = 0; cycle < 2; cycle++) {
      await page.setViewportSize({ width: 640, height: 900 })
      await expectSimple('Compact boundary')
      await page.mouse.move(80, 100)
      await page.mouse.move(480, 100, { steps: 8 })
      await expectSimple('Compact pointer movement', 1)
      await page.locator('.homepage-hub').dispatchEvent('pointerleave', { pointerType: 'mouse' })
      await expectSimple('Compact pointer leave')
      await page.setViewportSize({ width: 641, height: 900 })
      await expectDesktop('Desktop boundary')
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    assert.equal(await page.evaluate(() => document.querySelector('.homepage-hub-canvas') === window.__originalGrid), true)
    assert.equal(await page.locator('.homepage-hub-canvas').count(), 1)
    pass('Repeated crossings of the 640px boundary clear old state and restore a fresh game on the same canvas')

    const input = await context.newCDPSession(page)
    await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    await page.waitForFunction(() => matchMedia('(pointer: coarse)').matches)
    await expectSimple('Wide touch device')
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 100 }] })
    await expectSimple('Touch held', 1)
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expectSimple('Touch released')
    await input.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await page.waitForFunction(() => matchMedia('(hover: hover) and (pointer: fine)').matches)
    await expectDesktop('Mouse capability restored')
    pass('Input capability changes disable and restore the game without resizing; touch release clears its single highlight')

    for (const [startWidth, endWidth] of [[1440, 390], [390, 1440]]) {
      await page.setViewportSize({ width: startWidth, height: 900 })
      await fresh()
      await page.keyboard.press('Enter')
      await page.locator('.homepage-portal[data-phase="pushing"]').waitFor()
      await page.setViewportSize({ width: endWidth, height: 900 })
      await waitForHub()
      if (endWidth === 390) await expectSimple('Mobile after transition')
      else await expectDesktop('Desktop after transition')
    }
    pass('Resizing in either direction during the opening transition starts the correct second-screen effect')
    assert.deepEqual(errors, [])
  } finally { await context.close() }

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  })
  const touch = await touchContext.newPage()
  touch.on('pageerror', error => errors.push(error.message))
  try {
    await touch.goto(baseURL)
    await touch.locator('.launch-intro-enter').tap()
    await touch.locator('.homepage-portal[data-phase="hub"]').waitFor()
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
      await touch.setViewportSize(viewport)
      await touch.touchscreen.tap(100, 100)
      const pixels = await touch.locator('.homepage-hub-canvas').evaluate(async canvas => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        let brightPixels = 0
        for (let index = 0; index < data.length; index += 4) {
          if (data[index] > 100 || data[index + 1] > 100 || data[index + 2] > 100) brightPixels++
        }
        return brightPixels
      })
      assert.equal(pixels, 0, 'Mobile canvas contains only the dark grid after releasing touch')
      assert.equal(await touch.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    pass('Real mobile emulation stays free of game and trail pixels in portrait, landscape, and tablet sizes')
    assert.deepEqual(errors, [])
  } finally { await touchContext.close() }
  return checks
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.HOMEPAGE_BROWSER_EXECUTABLE
    ? { executablePath: process.env.HOMEPAGE_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.HOMEPAGE_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runHomepageGridChecks(browser, process.env.HOMEPAGE_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} homepage grid checks passed`)
  } finally { await browser.close() }
}
