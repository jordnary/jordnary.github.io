import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

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
    await page.waitForFunction(() => document.querySelector('.footer-brand-link').dataset.inView === 'true')
    assert.deepEqual(await footer.locator('.footer-nav-column').first().getByRole('link').allTextContents(), ['Home', 'About', 'Learning', 'Projects', 'Contact'])
    assert.equal(await footer.getByRole('link', { name: 'GitHub' }).getAttribute('target'), '_blank')
    assert.ok((await footer.getByRole('link', { name: 'Email' }).getAttribute('href')).startsWith('mailto:'))

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

    const trace = footer.locator('.footer-letter-trace').first()
    const startOffset = await trace.evaluate(element => getComputedStyle(element).strokeDashoffset)
    await page.waitForFunction(offset => getComputedStyle(document.querySelector('.footer-letter-trace')).strokeDashoffset !== offset, startOffset)
    const orbitSelector = '.footer-wordmark > g .footer-orbit'
    for (const selector of [orbitSelector, '.footer-circle-scan']) {
      const startTransform = await footer.locator(selector).evaluate(element => getComputedStyle(element).transform)
      await page.waitForFunction(({ selector, startTransform }) => getComputedStyle(document.querySelector(selector)).transform !== startTransform, { selector, startTransform })
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelector('.footer-brand-link').dataset.inView === 'false')
    for (const selector of ['.footer-letter-trace', '.footer-letter-echo', '.footer-orbit', '.footer-circle-scan']) {
      assert.equal(await footer.locator(selector).first().evaluate(element => getComputedStyle(element).animationPlayState), 'paused')
    }
    await footer.scrollIntoViewIfNeeded()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const selector of ['.footer-letter-trace', '.footer-letter-echo', '.footer-orbit', '.footer-circle-scan']) {
      assert.equal(await footer.locator(selector).first().evaluate(element => getComputedStyle(element).animationName), 'none')
    }
    assert.equal(await footer.locator('.footer-letter-outline').first().isVisible(), true)
    assert.equal(await footer.locator(orbitSelector).isVisible(), true)
    report('Outline tracing, O rotation, and circular scanning animate, pause offscreen, and respect reduced motion')

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
          const overflowing = [...element.querySelectorAll('a, .footer-clock-reading, .footer-clock-location, .footer-nav-column, .footer-meta')].some(child => {
            const rect = child.getBoundingClientRect()
            return rect.left < box.left - 1 || rect.right > box.right + 1 || child.scrollWidth > child.clientWidth + 1
          })
          const hasDividers = [...element.querySelectorAll('.footer-clock, .footer-nav, .footer-nav-column')].some(child => {
            const style = getComputedStyle(child)
            return parseFloat(style.borderLeftWidth) > 0 || parseFloat(style.borderRightWidth) > 0
          })
          return { overflowing, hasDividers, brand: bounds('.footer-brand-link'), wordmark: bounds('.footer-wordmark'), clock: bounds('.footer-clock'), menu: bounds('.footer-nav') }
        })
        assert.equal(layout.overflowing, false, `Footer content fits at ${width}px in ${theme} theme`)
        assert.equal(layout.hasDividers, false, 'Footer columns have no vertical dividing lines')
        assert.ok(layout.wordmark.width > layout.brand.width * 0.9, 'The wordmark fills its own region')
        if (width > 960) {
          assert.ok(layout.brand.right <= layout.clock.x + 1 && layout.clock.right <= layout.menu.x + 1, 'Desktop preserves brand, time, menu order')
          assert.ok(layout.brand.width > width * 0.45, 'Brand occupies the dominant desktop region')
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
    await runFooterChecks(browser, process.env.FOOTER_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Footer checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
