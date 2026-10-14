import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { runFooterRevealChecks } from './footer-reveal.browser.mjs'
import { runFooterOrbitChecks } from './footer-orbit.browser.mjs'

export async function runFooterChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, timezoneId: 'America/New_York' })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    sessionStorage.setItem('jordnary-theme', 'light')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const footer = page.locator('.footer-shell')
  const shot = async name => {
    if (!process.env.FOOTER_SCREENSHOT_DIR) return
    await mkdir(process.env.FOOTER_SCREENSHOT_DIR, { recursive: true })
    await footer.screenshot({ path: `${process.env.FOOTER_SCREENSHOT_DIR}/${name}.png` })
  }
  try {
    await page.goto(new URL('about/', baseURL).href)
    await footer.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    await page.waitForFunction(() => document.querySelector('.footer-brand').dataset.inView === 'true')
    const brand = footer.getByRole('img', { name: 'JORDNARY', exact: true })
    const currentURL = page.url()
    await brand.click()
    assert.equal(page.url(), currentURL, 'Clicking the wordmark does not navigate')
    assert.equal(await brand.evaluate(element => element.tabIndex), -1, 'The decorative wordmark is outside the tab order')
    await page.mouse.move(0, 0)
    assert.deepEqual(await footer.locator('.footer-nav-column').first().getByRole('link').allTextContents(), ['Home', 'About', 'Learning', 'Projects', 'Contact'])
    assert.equal(await footer.getByRole('link', { name: 'GitHub' }).getAttribute('target'), '_blank')
    assert.ok((await footer.getByRole('link', { name: 'Email' }).getAttribute('href')).startsWith('mailto:'))

    const orbitSelector = '.footer-wordmark > g .footer-orbit'
    await runFooterOrbitChecks(page, report)

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelector('.footer-brand').dataset.inView === 'false')
    const pausedOrbit = await footer.locator(orbitSelector).getAttribute('d')
    await page.waitForTimeout(700)
    assert.equal(await footer.locator(orbitSelector).getAttribute('d'), pausedOrbit, 'The orbit pauses offscreen')
    await footer.scrollIntoViewIfNeeded()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const reducedOrbit = await footer.locator(orbitSelector).getAttribute('d')
    await page.waitForTimeout(700)
    assert.equal(await footer.locator(orbitSelector).getAttribute('d'), reducedOrbit, 'Reduced motion freezes both rotation and morphing')
    assert.equal(await footer.locator('.footer-letter-shape').first().isVisible(), true)
    assert.equal(await footer.locator(orbitSelector).isVisible(), true)
    await page.mouse.move(0, 0)
    report('The wordmark remains visible; reduced motion and offscreen pause work')

    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      for (const width of [1920, 1440, 1024, 961, 960, 768, 681, 680, 560, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 })
        await footer.scrollIntoViewIfNeeded()
        const layout = await footer.evaluate(element => {
          const box = element.getBoundingClientRect()
          const bounds = selector => {
            const rect = element.querySelector(selector).getBoundingClientRect()
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
          }
          const overflowing = [...element.querySelectorAll('a, .footer-clock-reading, .footer-nav-column, .footer-meta')].some(child => {
            const rect = child.getBoundingClientRect()
            return rect.left < box.left - 1 || rect.right > box.right + 1 || child.scrollWidth > child.clientWidth + 1
          })
          const hasDividers = [...element.querySelectorAll('.footer-clock, .footer-nav, .footer-nav-column')].some(child => {
            const style = getComputedStyle(child)
            return parseFloat(style.borderLeftWidth) > 0 || parseFloat(style.borderRightWidth) > 0
          })
          return { overflowing, hasDividers, left: box.left, brand: bounds('.footer-brand'), wordmark: bounds('.footer-wordmark'), clock: bounds('.footer-clock'), clockDisplay: bounds('.footer-clock-display'), menu: bounds('.footer-nav'), menuHeading: bounds('.footer-nav .footer-heading') }
        })
        assert.equal(layout.overflowing, false, `Footer content fits at ${width}px in ${theme} theme`)
        assert.equal(layout.hasDividers, false, 'Footer columns have no vertical dividing lines')
        assert.ok(layout.wordmark.width > layout.brand.width * 0.8, 'The wordmark remains prominent with room on both sides')
        if (width > 960) {
          assert.ok(layout.brand.right <= layout.clock.x + 1 && layout.clock.right <= layout.menu.x + 1, 'Desktop preserves brand, time, menu order')
          assert.ok(layout.brand.width > width * 0.45, 'Brand occupies the dominant desktop region')
          const leftSpace = layout.wordmark.x - layout.left
          const clockSpace = layout.clockDisplay.x - layout.wordmark.right
          assert.ok(leftSpace >= 20 && clockSpace >= leftSpace, 'The wordmark has breathing room at the left edge and toward the clock')
          assert.ok(Math.abs(clockSpace - (layout.menuHeading.x - layout.clockDisplay.right)) < 1, 'Local time has balanced horizontal space toward the wordmark and menu')
          assert.ok(Math.abs(layout.clockDisplay.y - layout.menuHeading.y) < 1, 'Local time remains aligned with the menu headings at the top')
        } else {
          assert.ok(layout.brand.bottom <= layout.clock.y + 1, 'Smaller screens keep the wordmark above the controls')
          if (width <= 680) assert.ok(layout.clock.bottom <= layout.menu.y + 1, 'Mobile stacks time above the two menu columns')
        }
        if ([1920, 1440, 768, 390, 320].includes(width)) await shot(`footer-${theme}-${width}`)
      }
    }
    report('Eleven viewport widths and both themes fit without clipping or overlapping footer content')

    await page.setViewportSize({ width: 1440, height: 960 })
    for (const [label, pathname] of [['Learning', '/learning/'], ['Projects', '/projects/'], ['Contact', '/contact/'], ['Home', '/home/'], ['About', '/about/']]) {
      await footer.scrollIntoViewIfNeeded()
      await footer.getByRole('link', { name: label, exact: true }).click()
      await page.waitForURL(url => url.pathname.endsWith(pathname))
      await footer.waitFor()
    }
    await page.keyboard.press('Tab')
    await footer.getByRole('link', { name: 'Projects', exact: true }).focus()
    assert.equal(await footer.getByRole('link', { name: 'Projects', exact: true }).evaluate(element => getComputedStyle(element).outlineStyle), 'solid')

    // Install the mocked clock only after checking animations with real RAF time.
    const clock = footer.locator('time')
    assert.equal(await clock.evaluate(element => {
      const expected = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(element.dateTime))
      return element.textContent === expected
    }), true, 'Shanghai time is independent of the visitor time zone')
    const firstTime = await clock.textContent()
    await page.waitForFunction(previous => document.querySelector('.footer-clock time').textContent !== previous, firstTime)
    await page.clock.setFixedTime(new Date('2026-12-31T16:00:00Z'))
    await page.waitForFunction(() => document.querySelector('.footer-clock time').textContent === '00:00:00')
    report('Shanghai time updates every second and formats midnight as 00:00:00 across visitor time zones')

    assert.deepEqual(errors, [])
    report('All five menu destinations navigate successfully, keyboard focus is visible, and no page errors occur')
  } finally {
    await context.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.FOOTER_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runFooterRevealChecks(browser, process.env.FOOTER_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    await runFooterChecks(browser, process.env.FOOTER_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Footer checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
