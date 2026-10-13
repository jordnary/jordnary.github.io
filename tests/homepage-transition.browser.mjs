import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runHomepageTransitionChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const checks = []
  const pass = (name) => { checks.push(name); report(name) }
  page.on('pageerror', error => errors.push(error.message))
  const fresh = async () => {
    await page.goto(baseURL)
    await page.locator('.launch-intro-enter').waitFor()
  }
  const hub = () => page.locator('.homepage-portal[data-phase="hub"]').waitFor({ timeout: 5000 })

  try {
    await fresh()
    const result = await page.evaluate(async () => {
      const portal = document.querySelector('.homepage-portal')
      const intro = document.querySelector('.homepage-portal-intro')
      const directory = document.querySelector('.homepage-portal-hub')
      const wave = document.querySelector('.homepage-portal-wave')
      const canvas = document.querySelector('.homepage-hub-canvas')
      const path = wave.querySelector('path')
      const foreground = [...document.querySelectorAll('.homepage-hub-reveal-item')]
      const readForeground = () => foreground.map(element => {
        const style = getComputedStyle(element)
        return { opacity: Number(style.opacity), filter: style.filter }
      })
      let foregroundAtWaveEnd = null
      const onWaveEnd = event => {
        if (event.animationName === 'portal-wave-exit') foregroundAtWaveEnd = readForeground()
      }
      document.addEventListener('animationend', onWaveEnd, true)
      let pathMutations = 0
      const observer = new MutationObserver(records => { pathMutations += records.length })
      observer.observe(path, { attributes: true, attributeFilter: ['d'] })
      const samples = []
      const frames = []
      let last = performance.now()
      const started = last
      document.querySelector('.launch-intro-enter').click()
      await new Promise((resolve, reject) => {
        const frame = now => {
          frames.push(now - last)
          last = now
          const phase = portal.dataset.phase
          if (phase === 'hub') { resolve(); return }
          if (now - started > 4000) { reject(new Error('Transition did not finish')); return }
          const edge = intro.getBoundingClientRect().bottom
          samples.push({
            phase,
            edge,
            hubTop: directory.getBoundingClientRect().top,
            waveBottom: path.getBoundingClientRect().bottom,
            waveTop: path.getBoundingClientRect().top,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            inert: directory.inert,
            foreground: readForeground(),
            backgroundActive: document.querySelector('.homepage-hub').dataset.backgroundActive,
          })
          requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      })
      observer.disconnect()
      document.removeEventListener('animationend', onWaveEnd, true)
      const sorted = frames.slice(1).sort((a, b) => a - b)
      return { samples, pathMutations, foregroundAtWaveEnd,
        backgroundAtCompletion: document.querySelector('.homepage-hub').dataset.backgroundActive,
        released: getComputedStyle(directory).transform === 'none'
          && !directory.getAnimations().some(animation => animation.animationName?.startsWith('portal-')),
        overlayRemoved: !document.querySelector('.transition-wipe-overlay'),
        focused: document.activeElement === directory,
        frames: { count: sorted.length, p95: sorted[Math.floor(sorted.length * 0.95)], max: Math.max(...sorted) },
      }
    })
    assert.ok(result.samples.some(sample => sample.phase === 'pushing'))
    assert.ok(result.samples.some(sample => sample.phase === 'settling'))
    assert.ok(result.samples.every(sample => sample.waveTop <= sample.edge + 1))
    assert.ok(result.samples.every((sample, index, samples) => index === 0 || sample.edge <= samples[index - 1].edge + 1))
    assert.ok(result.samples.every((sample, index, samples) => index === 0 || sample.hubTop <= samples[index - 1].hubTop + 1))
    assert.ok(result.samples.some(sample => sample.phase === 'settling' && sample.edge <= 1 && sample.waveBottom > 90))
    assert.ok(result.samples.at(-1).waveBottom < 0)
    pass('The first screen leaves before the wave; both screens move continuously with no gap above the wave')
    assert.equal(result.pathMutations, 0)
    assert.ok(result.samples.every(sample => sample.canvasWidth === 300 && sample.canvasHeight === 150))
    assert.ok(result.samples.every(sample => sample.inert))
    assert.ok(result.released && result.overlayRemoved && result.focused)
    pass('No path rewrites or background canvas rendering during the transition; layers and focus released afterwards')
    assert.ok(result.samples.some(sample => sample.foreground.every(item => item.opacity === 0)))
    assert.ok(result.samples.some(sample => sample.foreground.every(item => item.opacity > 0 && item.opacity < 0.99)))
    assert.ok(result.foregroundAtWaveEnd?.every(item => item.opacity >= 0.999 && item.filter === 'none'))
    assert.ok(result.samples.every(sample => sample.backgroundActive === 'false'))
    assert.equal(result.backgroundAtCompletion, 'true')
    pass('All foreground items fade in progressively, finish with the wave, and hand off immediately to the background')
    report(`Frame intervals (local diagnostic): p95=${result.frames.p95.toFixed(1)}ms, max=${result.frames.max.toFixed(1)}ms`)
    await page.waitForFunction(() => document.querySelector('.homepage-hub').dataset.backgroundActive === 'true')
    assert.ok(await page.locator('.homepage-hub-canvas').evaluate(canvas => canvas.width > 300))
    pass('The grid starts after the wave clears')

    await fresh()
    await page.evaluate(() => {
      // Simulate dropped end events and repeated wheel/keyboard input.
      document.addEventListener('animationend', event => event.stopImmediatePropagation(), true)
      document.addEventListener('transitionend', event => event.stopImmediatePropagation(), true)
      for (let index = 0; index < 6; index++) {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      }
    })
    await hub()
    assert.equal(await page.locator('.homepage-portal-hub').evaluate(element => element.inert), false)
    pass('Repeated input and missing end events cannot leave the portal locked')

    await fresh()
    await page.keyboard.press('Enter')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await hub()
    assert.equal(await page.locator('.transition-wipe-overlay').count(), 0)
    pass('Enabling reduced motion mid-transition finishes immediately')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 390, height: 844 })
    await fresh()
    await page.keyboard.press('Enter')
    await page.setViewportSize({ width: 844, height: 390 })
    await hub()
    assert.equal(await page.locator('.homepage-portal-hub').evaluate(element => Math.round(element.getBoundingClientRect().top)), 0)
    assert.ok(await page.locator('.homepage-portal-hub').evaluate(element => element.scrollHeight > element.clientHeight))
    pass('Rotation during transition preserves the final position and scrollable directory')
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
    const checks = await runHomepageTransitionChecks(browser, process.env.HOMEPAGE_TEST_URL || 'http://localhost:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} homepage transition checks passed`)
  } finally { await browser.close() }
}
