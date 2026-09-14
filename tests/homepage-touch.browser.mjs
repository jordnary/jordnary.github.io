import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Use native Chromium touch input so browser gesture handling participates.
export async function runHomepageTouchChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true,
  })
  const page = await context.newPage()
  const input = await context.newCDPSession(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const checks = []
  const pass = (name) => { checks.push(name); report(name) }
  const portal = page.locator('.homepage-portal')
  const freshIntro = async () => {
    await page.goto(baseURL)
    await page.locator('.homepage-portal[data-phase="intro"]').waitFor()
  }
  const touch = (type, points = []) => input.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(([x, y], id) => ({ x, y, id })),
  })
  const swipe = async (from, to, { cancel = false, multiple = false } = {}) => {
    const points = ([x, y]) => multiple ? [[x, y], [x + 70, y]] : [[x, y]]
    await touch('touchStart', points(from))
    for (let step = 1; step <= 8; step++) {
      await touch('touchMove', points(from.map((value, axis) => value + (to[axis] - value) * step / 8)))
      await page.waitForTimeout(16)
    }
    await touch(cancel ? 'touchCancel' : 'touchEnd')
  }
  const expectHub = async () => {
    await page.locator('.homepage-portal[data-phase="hub"]').waitFor({ timeout: 5000 })
    assert.equal(await page.locator('.homepage-portal-intro').count(), 0)
    assert.equal(await page.locator('.homepage-portal-hub').evaluate((element) => element.inert), false)
    assert.equal(await page.locator('.homepage-hub').getAttribute('data-revealed'), 'true')
    assert.equal(await page.locator('.homepage-portal-hub').evaluate((element) => document.activeElement === element), true)
  }
  try {
    await freshIntro()
    await swipe([170, 650], [180, 370])
    assert.equal(await portal.getAttribute('data-phase'), 'pushing')
    await expectHub()
    pass('Native upward swipe completes the animated transition and focuses the hub')

    await freshIntro()
    await page.touchscreen.tap(170, 650)
    assert.equal(await portal.getAttribute('data-phase'), 'intro')
    for (const [name, from, to, options] of [
      ['Short movement', [170, 650], [172, 630]],
      ['Downward swipe', [170, 560], [175, 760]],
      ['Horizontal swipe', [70, 650], [310, 620]],
      ['Mostly horizontal diagonal swipe', [70, 650], [310, 540]],
      ['Cancelled swipe', [170, 650], [175, 370], { cancel: true }],
      ['Two-finger swipe', [120, 650], [130, 370], { multiple: true }],
    ]) {
      await swipe(from, to, options)
      assert.equal(await portal.getAttribute('data-phase'), 'intro', name)
      pass(`${name} keeps the intro visible`)
    }
    await swipe([170, 650], [175, 370])
    await expectHub()
    pass('A new upward swipe works after ignored and cancelled gestures')

    // A short landscape viewport must still allow normal scrolling on screen two.
    await page.setViewportSize({ width: 740, height: 360 })
    await swipe([650, 290], [650, 100])
    assert.ok(await page.locator('.homepage-portal-hub').evaluate((element) => element.scrollTop > 0))
    assert.equal(await portal.getAttribute('data-phase'), 'hub')
    pass('The hub retains native touch scrolling on short viewports')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await freshIntro()
    await swipe([170, 650], [180, 370])
    await expectHub()
    pass('Upward swipe also works with reduced motion')

    for (const selector of ['.launch-intro-enter', '.launch-intro-scroll']) {
      await freshIntro()
      await page.locator(selector).tap()
      await expectHub()
      pass(`${selector} still enters on tap`)
    }

    await freshIntro()
    await page.keyboard.press('Enter')
    await expectHub()
    pass('Keyboard entry remains available')

    await freshIntro()
    await page.mouse.wheel(0, 150)
    await expectHub()
    pass('Mouse wheel entry remains available')
    assert.deepEqual(errors, [])
    return checks
  } finally { await context.close() }
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.HOMEPAGE_BROWSER_EXECUTABLE
    ? { executablePath: process.env.HOMEPAGE_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.HOMEPAGE_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runHomepageTouchChecks(browser, process.env.HOMEPAGE_TEST_URL || 'http://127.0.0.1:5173/', (name) => console.log(`PASS: ${name}`))
    console.log(`${checks.length} homepage input checks passed`)
  } finally { await browser.close() }
}
