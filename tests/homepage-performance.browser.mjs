import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

async function measure(page, session, action) {
  const events = []
  const collect = ({ value }) => events.push(...value)
  session.on('Tracing.dataCollected', collect)
  await session.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' })
  const frames = await page.evaluate(action)
  const complete = new Promise(resolve => session.once('Tracing.tracingComplete', resolve))
  await session.send('Tracing.end')
  await complete
  session.off('Tracing.dataCollected', collect)
  const total = name => events.filter(event => event.name === name)
  const paints = total('Paint')
  return {
    frames,
    paints: paints.length,
    paintMs: Number((paints.reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000).toFixed(2)),
    layouts: total('Layout').length,
  }
}

async function checkPlayback(page) {
  const readPlanets = () => page.locator('.launch-intro-planet').evaluateAll(planets => planets.map(planet => {
    const animation = planet.getAnimations()[0]
    return { transform: getComputedStyle(planet).transform, time: animation?.currentTime, state: animation?.playState }
  }))
  const before = await readPlanets()
  await page.waitForTimeout(120)
  const moving = await readPlanets()
  assert.ok(moving.every((planet, index) => planet.state === 'running' && planet.transform !== before[index].transform))

  // Simulate a visibility lifecycle event without freezing the test driver.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(60)
  const paused = await readPlanets()
  await page.waitForTimeout(120)
  assert.deepEqual(await readPlanets(), paused, 'Hidden-tab orbits must freeze in place')
  assert.ok(paused.every(planet => planet.state === 'paused'))
  assert.equal(await page.locator('.launch-intro-fluid').first().evaluate(element => getComputedStyle(element).animationPlayState), 'paused')

  // Resizing while paused must preserve progress rather than restarting an orbit.
  const viewport = page.viewportSize()
  await page.setViewportSize({ ...viewport, width: Math.round(viewport.width * 0.75) })
  await page.waitForTimeout(120)
  const resized = await readPlanets()
  assert.deepEqual(resized.map(planet => planet.time), paused.map(planet => planet.time))
  assert.ok(resized.some((planet, index) => planet.transform !== paused[index].transform))
  await page.setViewportSize(viewport)
  await page.evaluate(() => {
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(120)
  assert.ok((await readPlanets()).every((planet, index) => planet.state === 'running' && planet.time > paused[index].time))

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  const reduced = await readPlanets()
  await page.waitForTimeout(120)
  assert.deepEqual(await readPlanets(), reduced, 'Reduced motion must stop existing native animations')
  assert.ok(reduced.every(planet => planet.state === 'paused'))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(120)
  assert.ok((await readPlanets()).every(planet => planet.state === 'running'))
}

export async function runHomepagePerformanceChecks(browser, baseURL, report = () => {}, { diagnostic = false } = {}) {
  for (const profile of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ]) {
    const { name, ...options } = profile
    const context = await browser.newContext(options)
    const page = await context.newPage()
    const session = await context.newCDPSession(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.goto(baseURL)
      await page.locator('.launch-intro-enter').waitFor()
      // Exclude one-time font loading and the introductory letter reveal.
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(2500)
      if (!diagnostic) await checkPlayback(page)
      const idle = await measure(page, session, async () => {
        const intervals = []
        const started = performance.now()
        let last = started
        await new Promise(resolve => {
          const sample = time => {
            intervals.push(time - last)
            last = time
            if (time - started >= 1800) resolve()
            else requestAnimationFrame(sample)
          }
          requestAnimationFrame(sample)
        })
        const sorted = intervals.slice(1).sort((a, b) => a - b)
        return { count: sorted.length, p95: sorted[Math.floor(sorted.length * 0.95)], max: Math.max(...sorted) }
      })
      const transition = await measure(page, session, async () => {
        const intervals = []
        const portal = document.querySelector('.homepage-portal')
        const planets = [...document.querySelectorAll('.launch-intro-planet')]
        const started = performance.now()
        let last = started
        document.querySelector('.launch-intro-enter').click()
        await new Promise((resolve, reject) => {
          const sample = time => {
            intervals.push(time - last)
            last = time
            if (portal.dataset.phase === 'hub') resolve()
            else if (portal.dataset.phase !== 'intro' && planets.some(planet => planet.getAnimations().some(animation => animation.playState === 'running'))) {
              reject(new Error('Idle orbital work continued during the transition'))
            }
            else if (time - started > 5000) reject(new Error('Portal remained locked'))
            else requestAnimationFrame(sample)
          }
          requestAnimationFrame(sample)
        })
        const sorted = intervals.slice(1).sort((a, b) => a - b)
        return { count: sorted.length, p95: sorted[Math.floor(sorted.length * 0.95)], max: Math.max(...sorted) }
      })
      report(JSON.stringify({ profile: name, cpuSlowdown: 4, idle, transition }))
      if (!diagnostic) {
        // Composited idle motion must not repaint on each display frame.
        assert.ok(idle.paints <= 12, `${name}: idle animations caused ${idle.paints} paints`)
        assert.equal(idle.layouts, 0, `${name}: idle animations triggered layout`)
        assert.equal(await page.locator('.homepage-portal-intro').count(), 0)
        assert.equal(await page.locator('.homepage-portal-hub').evaluate(element => element.inert), false)
        assert.equal(await page.locator('.homepage-hub-reveal-item').evaluateAll(elements => elements.some(element => element.getAnimations().length > 0)), false)
        assert.deepEqual(errors, [])
      }
    } finally { await context.close() }
  }
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.HOMEPAGE_BROWSER_EXECUTABLE
    ? { executablePath: process.env.HOMEPAGE_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.HOMEPAGE_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runHomepagePerformanceChecks(browser, process.env.HOMEPAGE_TEST_URL || 'http://127.0.0.1:5173/', console.log,
      { diagnostic: process.argv.includes('--diagnostic') })
  } finally { await browser.close() }
}
