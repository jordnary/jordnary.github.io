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

    const ink = footer.locator('.footer-ink-field')
    const rasterInk = (options = {}) => ink.evaluate(async (field, options) => {
      // Isolate the rendered pigment from letter clipping and the rotating O.
      // Center each sample on the body so translation alone cannot pass.
      const source = field.closest('svg')
      const core = field.querySelector('.footer-ink-core')
      if (options.gesture) {
        const bounds = source.getBoundingClientRect()
        const startX = Number(core.getAttribute('cx'))
        const startY = Number(core.getAttribute('cy'))
        const steps = options.gesture.steps
        for (let step = 1; step <= steps; step++) {
          // Keep a slow gesture slow on displays with a high refresh rate.
          if (options.gesture.duration) await new Promise(resolve => setTimeout(resolve, options.gesture.duration / steps))
          source.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true,
            clientX: bounds.x + (startX + options.gesture.distance * step / steps) / source.viewBox.baseVal.width * bounds.width,
            clientY: bounds.y + startY / source.viewBox.baseVal.height * bounds.height,
          }))
          await new Promise(requestAnimationFrame)
        }
        // Sample the gesture's last frame before the pigment starts catching up.
      }
      const origin = options.origin || { x: Number(core.getAttribute('cx')), y: Number(core.getAttribute('cy')) }
      const grayLead = Number(field.querySelector('.footer-ink-wash-far circle').getAttribute('cx')) - Number(core.getAttribute('cx'))
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      svg.setAttribute('width', '420')
      svg.setAttribute('height', '420')
      svg.setAttribute('viewBox', `${origin.x - 210} ${origin.y - 210} 420 420`)
      svg.append(source.querySelector('defs').cloneNode(true))
      const clone = field.cloneNode(true)
      const originals = [field, ...field.querySelectorAll('*')]
      for (const [index, element] of [clone, ...clone.querySelectorAll('*')].entries()) {
        const style = getComputedStyle(originals[index])
        element.setAttribute('fill', style.fill)
        element.setAttribute('opacity', style.opacity)
      }
      svg.append(clone)
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
      try {
        const image = new Image()
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 420
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(0, 0, 420, 420).data
        if (options.includeGray) return { pixels: Array.from({ length: 420 * 420 }, (_, index) => pixels[index * 4 + 3]), grayLead }
        return Array.from({ length: 420 * 420 }, (_, index) => pixels[index * 4 + 3] > 192 ? 1 : 0)
      } finally { URL.revokeObjectURL(url) }
    }, options)
    const wordmarkBox = await footer.locator('.footer-wordmark').boundingBox()
    assert.equal(await ink.getAttribute('data-active'), 'false', 'Ink stays absent until the pointer enters')
    await page.mouse.move(wordmarkBox.x + wordmarkBox.width * 0.28, wordmarkBox.y + wordmarkBox.height * 0.5)
    await page.waitForFunction(() => Number(document.querySelector('.footer-ink-core').getAttribute('r')) > 100)
    assert.equal(await ink.getAttribute('data-active'), 'true')
    await page.mouse.move(wordmarkBox.x + wordmarkBox.width * 0.68, wordmarkBox.y + wordmarkBox.height * 0.5, { steps: 8 })
    await page.waitForFunction(() => {
      const coreX = Number(document.querySelector('.footer-ink-core').getAttribute('cx'))
      return coreX > 800 && Number(document.querySelector('.footer-ink-wash-far circle').getAttribute('cx')) - coreX > 2
    })
    const geometry = await ink.evaluate(element => {
      const core = element.querySelector('.footer-ink-core').getBBox()
      const capHeight = element.closest('svg').querySelector('.footer-letter-shape').getBBox().height
      return { diameter: core.width, height: core.height, footprint: element.getBBox().width, capHeight }
    })
    assert.ok(Math.abs(geometry.diameter - geometry.height) < 1, 'The ink body remains round')
    assert.ok(geometry.diameter / geometry.capHeight > 1.2 && geometry.diameter / geometry.capHeight < 1.55, 'Ink size stays proportional to letter height')
    assert.ok(geometry.footprint < geometry.capHeight * 1.9, 'A fast sweep does not leave a long tail')
    await shot('footer-wordmark-ink')
    await page.mouse.move(wordmarkBox.x + wordmarkBox.width * 0.28, wordmarkBox.y + wordmarkBox.height * 0.5, { steps: 8 })
    await page.waitForFunction(() => Number(document.querySelector('.footer-ink-wash-far circle').getAttribute('cx')) - Number(document.querySelector('.footer-ink-core').getAttribute('cx')) < -2)
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('.footer-ink-wash-far circle').getAttribute('cx')) - Number(document.querySelector('.footer-ink-core').getAttribute('cx'))) < 0.02)
    await page.waitForTimeout(200)
    const beforeGesture = await rasterInk()
    assert.ok(beforeGesture.reduce((sum, pixel) => sum + pixel, 0) > 40000, 'The visual sample contains a substantial ink body')
    const roundBody = (pixels) => {
      let centralHoles = 0
      let distantInk = 0
      for (let index = 0; index < pixels.length; index++) {
        const distance = Math.hypot(index % 420 + 0.5 - 210, Math.floor(index / 420) + 0.5 - 210)
        if (distance < 130 && !pixels[index]) centralHoles++
        if (distance > 180 && pixels[index]) distantInk++
      }
      assert.ok(centralHoles < 20 && distantInk < 20, `The rendered body stays round and solid without deep cuts or large protrusions (${centralHoles} central holes, ${distantInk} distant pixels)`)
    }
    roundBody(beforeGesture)
    await page.mouse.move(wordmarkBox.x + wordmarkBox.width * 0.34, wordmarkBox.y + wordmarkBox.height * 0.5, { steps: 8 })
    await page.mouse.move(wordmarkBox.x + wordmarkBox.width * 0.28, wordmarkBox.y + wordmarkBox.height * 0.5, { steps: 8 })
    await page.waitForTimeout(1000)
    const afterGesture = await rasterInk()
    roundBody(afterGesture)
    const changedPixels = beforeGesture.filter((pixel, index) => pixel !== afterGesture[index]).length
    assert.ok(changedPixels > 1000, 'A gesture reshapes the rendered ink even when the pointer returns to the same position')
    await page.waitForTimeout(250)
    assert.deepEqual(await rasterInk(), afterGesture, 'The rendered ink boundary stops evolving after motion settles')
    report('Pixel comparisons confirm gesture-driven boundary changes and a stable shape at rest')
    const slowSweep = await rasterInk({ gesture: { distance: 72, steps: 20, duration: 400 }, includeGray: true })
    await page.waitForTimeout(600)
    const origin = await ink.locator('.footer-ink-core').evaluate(core => ({ x: Number(core.getAttribute('cx')), y: Number(core.getAttribute('cy')) }))
    const newlyWetted = await rasterInk({ gesture: { distance: 72, steps: 1 }, includeGray: true, origin })
    assert.ok(newlyWetted.grayLead > slowSweep.grayLead * 1.7 && newlyWetted.grayLead > 35, 'Fast motion exposes a wider gray region before pigment develops')
    await page.waitForTimeout(250)
    const developed = await rasterInk({ includeGray: true, origin })
    const darkened = newlyWetted.pixels.filter((alpha, index) => alpha > 30 && alpha < 160 && developed.pixels[index] > 230).length
    assert.ok(darkened > 1000, 'The same newly covered pixels change from gray wash to dark ink after the pointer stops')
    report('Slow and fast gestures confirm that gray coverage precedes dark pigment and widens with speed')
    await page.mouse.move(0, 0)
    await page.waitForFunction(() => document.querySelector('.footer-ink-field').dataset.active === 'false')
    assert.equal(await ink.locator('circle').evaluateAll(circles => circles.every(circle => circle.getAttribute('r') === '0')), true, 'Ink dissipates after the pointer leaves')
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
    await page.mouse.move(wordmarkBox.x + wordmarkBox.width * 0.5, wordmarkBox.y + wordmarkBox.height * 0.5)
    assert.equal(await ink.getAttribute('data-active'), 'false', 'Reduced motion suppresses pointer ink')
    await page.mouse.move(0, 0)
    report('Round ink follows the pointer without a long tail; gray diffusion leads in both directions and settles at rest; reduced motion and offscreen pause work')

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
