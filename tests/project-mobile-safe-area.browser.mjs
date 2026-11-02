import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

async function setSafeArea(page, { top = 0, bottom = 0, left = 0, right = 0 }) {
  await page.locator('.projects-archive').evaluate((archive, insets) => {
    for (const [side, value] of Object.entries(insets)) archive.style.setProperty(`--archive-safe-${side}`, `${value}px`)
    window.dispatchEvent(new Event('resize'))
  }, { top, bottom, left, right })
  await frames(page)
}

export async function runProjectMobileSafeAreaChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const viewportContent = () => page.locator('meta[name="viewport"]').getAttribute('content')
  try {
    const response = await page.goto(new URL('projects/', baseURL).href)
    assert.match(await response.text(), /name="viewport" content="[^"]*viewport-fit=cover/, 'The initial HTML opts into full-screen coverage')
    await page.locator('.archive-project-link').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.locator('.archive-background').evaluate(image => image.decode())
    assert.match(await viewportContent(), /viewport-fit=cover/)

    // Desktop browser emulation does not provide a notch or Safari toolbar.
    // Exercise their insets separately from changes to the layout viewport.
    await setSafeArea(page, { top: 59, bottom: 34 })
    for (const [width, height] of [[390, 844], [430, 932], [390, 700], [320, 568]]) {
      await page.setViewportSize({ width, height })
      await frames(page)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      const layout = await page.evaluate(() => {
        const bounds = selector => document.querySelector(selector).getBoundingClientRect().toJSON()
        return {
          background: bounds('.archive-background'), wordmark: bounds('.archive-wordmark'),
          header: bounds('.archive-header'), first: bounds('.archive-project-link'),
          shellBackground: getComputedStyle(document.querySelector('.app-shell')).backgroundColor,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }
      })
      assert.equal(layout.shellBackground, 'rgba(0, 0, 0, 0)', 'The shared shell cannot expose an opaque strip below the artwork')
      assert.ok(layout.background.top <= 0 && layout.background.bottom >= height)
      assert.ok(layout.wordmark.top >= 59 && layout.wordmark.bottom < layout.header.top)
      assert.ok(layout.first.top >= layout.header.bottom + 35)
      assert.equal(layout.overflow, false)

      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
      await frames(page)
      const last = await page.locator('.archive-project-link').last().boundingBox()
      assert.ok(last.y + last.height <= height - 34 - 40, 'The last project scrolls fully above the bottom safe area')
      const bottomHit = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight - 8)?.className)
      assert.equal(bottomHit, 'archive-footer-mask', 'The bottom safe area paints artwork and cannot activate a project behind it')
    }
    report('Notch and home-indicator insets preserve top artwork, readable headings and the complete last project at four phone sizes')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 700 })
      visualViewport.dispatchEvent(new Event('resize'))
      const link = document.querySelectorAll('.archive-project-link')[5]
      window.scrollTo({ top: scrollY + link.getBoundingClientRect().top - 720, behavior: 'instant' })
    })
    await frames(page)
    assert.equal(await page.evaluate(() => document.elementFromPoint(220, 735)?.className), 'archive-footer-mask',
      'Text under expanded browser chrome is neither visible nor clickable')

    const masked = await page.screenshot()
    await page.locator('.archive-list').evaluate(list => { list.style.visibility = 'hidden' })
    await page.locator('.archive-footer-mask').evaluate(mask => { mask.style.visibility = 'hidden' })
    const backgroundOnly = await page.screenshot()
    const crop = { left: 100, top: 675, width: 250, height: 160 }
    const maskedPixels = await sharp(masked).extract(crop).raw().toBuffer()
    const backgroundPixels = await sharp(backgroundOnly).extract(crop).raw().toBuffer()
    assert.ok(maskedPixels.equals(backgroundPixels), 'The bottom mask matches the artwork pixel-for-pixel instead of introducing an opaque band')
    await page.locator('.archive-list').evaluate(list => list.style.removeProperty('visibility'))
    await page.locator('.archive-footer-mask').evaluate(mask => mask.style.removeProperty('visibility'))

    for (const [height, offsetTop] of [[780, 0], [700, 16], [844, 0]]) {
      await page.evaluate(({ height, offsetTop }) => {
        Object.defineProperty(visualViewport, 'height', { configurable: true, value: height })
        Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: offsetTop })
        visualViewport.dispatchEvent(new Event('resize'))
        visualViewport.dispatchEvent(new Event('scroll'))
      }, { height, offsetTop })
      await frames(page)
      const boundary = height + offsetTop - 34
      assert.equal(await page.evaluate(y => document.elementFromPoint(220, y)?.className, boundary + 4), 'archive-footer-mask')
      assert.notEqual(await page.evaluate(y => document.elementFromPoint(220, y)?.className, boundary - 4), 'archive-footer-mask')
    }
    await page.evaluate(() => {
      delete visualViewport.height
      delete visualViewport.offsetTop
      visualViewport.dispatchEvent(new Event('resize'))
    })
    report('Expanding, collapsing and offsetting the visual viewport clips text at the browser edge while retaining continuous background pixels')

    await page.setViewportSize({ width: 844, height: 390 })
    await setSafeArea(page, { bottom: 21, left: 59, right: 59 })
    const wordmark = await page.locator('.archive-wordmark').first().boundingBox()
    const header = await page.locator('.archive-header').boundingBox()
    assert.ok(wordmark.x >= 59 && header.x + header.width <= 844 - 59)
    await page.getByRole('button', { name: 'Open menu', exact: true }).tap()
    await page.waitForFunction(() => document.querySelector('.archive-menu')?.dataset.state === 'open')
    const close = page.getByRole('button', { name: 'Close menu', exact: true })
    const closeBounds = await close.boundingBox()
    assert.ok(closeBounds.x >= 59 && closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= 390 - 21)
    await close.tap()

    await page.setViewportSize({ width: 390, height: 844 })
    await setSafeArea(page, { top: 59, bottom: 34 })
    await page.getByRole('button', { name: 'Visual', exact: true }).tap()
    await page.waitForFunction(() => document.querySelectorAll('.archive-project').length === 1)
    assert.equal(await page.evaluate(() => scrollY), 0, 'Filtering still resets native document scrolling')
    await page.getByRole('button', { name: 'All', exact: true }).tap()
    await page.waitForFunction(() => document.querySelectorAll('.archive-project').length > 1)
    await page.locator('.archive-project-link').first().tap()
    await page.locator('.project-reader').waitFor()
    assert.doesNotMatch(await viewportContent(), /viewport-fit=cover/, 'Leaving the archive restores the other pages\' viewport policy')
    await page.goBack()
    await page.locator('.archive-project-link').first().waitFor()
    assert.match(await viewportContent(), /viewport-fit=cover/)
    await page.reload()
    await page.locator('.archive-project-link').first().waitFor()
    assert.match(await viewportContent(), /viewport-fit=cover/)
    report('Landscape safe areas, menu controls, filters, detail navigation, Back and reload remain functional')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const playwright = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const engine = process.env.PROJECTS_BROWSER_ENGINE || 'chromium'
  const browser = await playwright[engine].launch({ ...(engine === 'chromium' ? { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge' } : {}), headless: true })
  try {
    await runProjectMobileSafeAreaChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Project mobile safe-area checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
