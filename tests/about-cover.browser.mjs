import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const expectedTimings = [
  ['.journey-eyebrow', 720, 0],
  ['#about-title > span:first-child', 850, 90],
  ['#about-title > span:nth-child(2)', 850, 200],
  ['#about-title .journey-cover-draw', 900, 520],
  ['.journey-handwritten', 720, 380],
  ['.journey-atlas-drawing', 1000, 240],
  ['.journey-atlas-trail', 1600, 420],
  ['.journey-atlas-topic-cs', 720, 380],
  ['.journey-atlas-topic-ai', 720, 480],
  ['.journey-atlas-topic-web', 720, 580],
  ['.journey-iceberg-summit', 1100, 260],
]

export async function runAboutCoverChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    window.aboutCoverAnimations = []
    const animate = Element.prototype.animate
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options)
      if (this.matches('.journey-cover-reveal, .journey-cover-draw')) {
        const record = { element: this, animation, samples: [] }
        window.aboutCoverAnimations.push(record)
        if (this.matches('#about-title > span:first-child')) {
          const sample = () => {
            if (animation.playState === 'idle') return
            record.samples.push(Number(getComputedStyle(this).opacity))
            if (animation.playState !== 'finished') requestAnimationFrame(sample)
          }
          requestAnimationFrame(sample)
        }
      }
      return animation
    }
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(new URL('about/', baseURL).href, { waitUntil: 'domcontentloaded' })
    await page.locator('.journey-cover').waitFor()
    // Read the browser's actual timings, including minified CSS in a preview build.
    const timings = await page.evaluate(selectors => selectors.map(selector => {
      const record = window.aboutCoverAnimations.findLast(entry => entry.element.matches(selector))
      if (!record) return null
      const { duration, delay } = record.animation.effect.getTiming()
      return { duration, delay }
    }), expectedTimings.map(([selector]) => selector))
    expectedTimings.forEach(([selector, duration, delay], index) => {
      assert.deepEqual(timings[index], { duration, delay }, `${selector} preserves its timing in milliseconds`)
    })
    report('All cover layers preserve their durations and staggered delays after CSS optimization')

    await page.waitForFunction(() => {
      const record = window.aboutCoverAnimations.findLast(entry => entry.element.matches('#about-title > span:first-child'))
      return record?.animation.playState === 'idle' && getComputedStyle(record.element).opacity === '1'
    })
    const samples = await page.evaluate(() => window.aboutCoverAnimations.findLast(entry =>
      entry.element.matches('#about-title > span:first-child')).samples)
    assert.ok(samples.filter(opacity => opacity > 0 && opacity < 0.99).length >= 3, 'The title visibly fades across multiple rendered frames')
    report('The title visibly fades in and releases its animation after completion')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    const staticCover = await page.locator('.journey-cover').evaluate(cover =>
      [...cover.querySelectorAll('.journey-cover-reveal, .journey-cover-draw')].every(element =>
        element.getAnimations().length === 0 && Number(getComputedStyle(element).opacity) > 0))
    assert.ok(staticCover, 'Reduced motion cancels every reveal and leaves all content visible')
    assert.deepEqual(errors, [], 'The cover produces no uncaught browser errors')
    report('Reduced motion keeps all cover content visible without reveal animations')
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ channel: process.env.ABOUT_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try {
    await runAboutCoverChecks(browser, process.env.ABOUT_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('About cover browser checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
