import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export async function runFooterRevealChecks(browser, baseURL, report = () => {}) {
  await runFooterTopNavigationChecks(browser, baseURL, report)
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const reveal = async progress => {
    await page.evaluate(progress => {
      const bounds = document.querySelector('.footer-shell').getBoundingClientRect()
      scrollTo({ top: scrollY + bounds.top - innerHeight + bounds.height * progress, behavior: 'instant' })
    }, progress)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return page.evaluate(() => {
      const footer = document.querySelector('.footer-shell')
      const surface = footer.querySelector('.footer-surface')
      const bounds = footer.getBoundingClientRect()
      return {
        top: bounds.top,
        height: bounds.height,
        surfaceHeight: surface.getBoundingClientRect().height,
        surfaceTop: surface.getBoundingClientRect().top,
        bottom: surface.getBoundingClientRect().bottom,
        viewport: innerHeight,
        mainBottom: document.querySelector('main').getBoundingClientRect().bottom + scrollY,
        overlay: getComputedStyle(surface, '::after').content,
        opacity: getComputedStyle(surface).opacity,
        leaks: Boolean(document.elementFromPoint(20, Math.max(0, bounds.top - 2))?.closest('.footer-shell')),
      }
    })
  }
  const shot = async name => {
    if (!process.env.FOOTER_SCREENSHOT_DIR) return
    await mkdir(process.env.FOOTER_SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({ path: `${process.env.FOOTER_SCREENSHOT_DIR}/${name}.png` })
  }
  const checkBelowPaper = async () => {
    // Paint a probe on the real footer, where the former blue seam hid content.
    const row = await page.evaluate(() => {
      const seam = document.querySelector('.section-paper-seam').getBoundingClientRect()
      const surface = document.querySelector('.footer-surface')
      const y = Math.floor(seam.bottom - 3)
      const probe = document.createElement('div')
      probe.dataset.seamProbe = ''
      Object.assign(probe.style, {
        position: 'absolute', left: '0', right: '0', height: '3px',
        top: `${y - surface.getBoundingClientRect().top}px`,
        background: 'rgb(242, 0, 213)', zIndex: '1', pointerEvents: 'none',
      })
      surface.append(probe)
      return y
    })
    try {
      const strip = await page.screenshot({ clip: { x: 0, y: row, width: page.viewportSize().width, height: 2 } })
      const pixels = await page.evaluate(async base64 => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        return [0.1, 0.3, 0.5, 0.7, 0.9].map(ratio => [...context.getImageData(Math.floor(image.width * ratio), 0, 1, 1).data])
      }, strip.toString('base64'))
      assert.ok(pixels.every(([r, g, b]) => r > 210 && g < 25 && b > 180), 'The actual footer remains visible directly below the paper, without an opaque blue band')
    } finally {
      await page.locator('[data-seam-probe]').evaluate(element => element.remove())
    }
  }
  try {
    await page.goto(new URL('contact/', baseURL).href)
    await page.locator('.footer-shell[data-reveal]').waitFor({ state: 'attached' })
    await page.evaluate(() => document.fonts.ready)
    const sharedFooter = await page.locator('.footer-shell').elementHandle()
    const checkPageEnd = async () => {
      // Let route styles, ResizeObserver and the scheduled measurement settle.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const frame = await reveal(1)
      assert.ok(await sharedFooter.evaluate(element => element.isConnected), 'Client navigation preserves the shared footer')
      assert.ok(Math.abs(frame.height - frame.surfaceHeight) < 1, 'The footer reserves its full height, including route-specific paper padding')
      assert.ok(Math.abs(frame.top - frame.surfaceTop) < 1, 'Scrolling to the page end fully reveals the footer without a refresh')
    }
    for (const width of [1920, 390]) {
      await page.setViewportSize({ width, height: 960 })
      for (const [label, route] of [['Contact', 'contact/'], ['About', 'about/']]) {
        await reveal(1)
        await page.locator('.footer-nav').getByRole('link', { name: label, exact: true }).click()
        await page.waitForURL(new URL(route, baseURL).href)
        await checkPageEnd()
      }
      await page.goBack()
      await page.waitForURL(new URL('contact/', baseURL).href)
      await checkPageEnd()
      await page.goForward()
      await page.waitForURL(new URL('about/', baseURL).href)
      await checkPageEnd()
    }
    report('Client navigation and history traversal preserve the full footer scroll range on desktop and mobile')

    for (const width of [1920, 1440, 768, 390]) {
      await page.setViewportSize({ width, height: 960 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
        const frames = []
        for (const progress of [0, 0.12, 0.35, 0.7, 1, 0.7, 0.35, 0.12, 0]) {
          frames.push(await reveal(progress))
          if (progress === 1) {
            await shot(`footer-reveal-${theme}-${width}`)
          }
          if (progress === 0.7) await checkBelowPaper()
        }
        assert.ok(frames.every(frame => Math.abs(frame.bottom - frame.viewport) < 1), 'The footer remains anchored to the viewport during reveal and conceal')
        assert.ok(frames.every(frame => Math.abs(frame.mainBottom - frames[0].mainBottom) < 1), 'Reveal never changes document layout')
        assert.ok(frames.every(frame => !frame.leaks && frame.opacity === '1'), 'The clipped surface never covers the preceding content or fades away')
        assert.ok(frames.every(frame => frame.overlay === 'none'), 'Entering and leaving the footer never adds a dark overlay')
        await reveal(-0.05)
        assert.equal((await reveal(0.2)).overlay, 'none', 'Re-entering the viewport keeps the footer at full brightness')
      }
    }
    report('Desktop and mobile reveal reversibly from beneath the page in both themes without shifting layout')
    report('The footer stays at full brightness on entry, reversal and re-entry')
    report('Content directly below the torn paper stays visible in both directions and themes across four screen widths')

    await page.setViewportSize({ width: 1440, height: 960 })
    await reveal(0.02)
    const scrolling = await page.evaluate(async () => {
      const footer = document.querySelector('.footer-shell')
      const surface = footer.querySelector('.footer-surface')
      const bounds = footer.getBoundingClientRect()
      const target = scrollY + bounds.bottom - innerHeight - 2
      const frames = []
      scrollTo({ top: target, behavior: 'smooth' })
      const start = performance.now()
      while (performance.now() - start < 900) {
        await new Promise(resolve => requestAnimationFrame(resolve))
        frames.push({ scroll: scrollY, drift: surface.getBoundingClientRect().bottom - innerHeight })
      }
      return frames
    })
    assert.ok(new Set(scrolling.map(frame => frame.scroll)).size > 8, 'The check samples a moving smooth scroll')
    assert.ok(scrolling.every(frame => Math.abs(frame.drift) < 1), 'Every sampled scrolling frame stays pinned without jitter')
    report('Continuous smooth scrolling keeps the footer within one pixel of its anchored position')

    const disableAnimations = await page.addStyleTag({ content: '.footer-surface { animation: none !important; }' })
    for (const progress of [0.1, 0.5, 0.9, 0.5, 0.1]) {
      const frame = await reveal(progress)
      assert.ok(Math.abs(frame.bottom - frame.viewport) < 1 && !frame.leaks, 'Uncover remains stationary and clipped even when CSS animations are unavailable')
    }
    await disableAnimations.evaluate(element => element.remove())
    report('The reveal works independently of CSS scroll-animation support')

    await reveal(1)
    await page.keyboard.press('Control+k')
    await page.waitForFunction(() => document.querySelector('.app-shell').classList.contains('is-search-open'))
    assert.ok(await page.locator('.footer-surface').evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return bounds.bottom <= innerHeight + 1 && bounds.top >= 0
    }), 'Opening search keeps the blurred footer in its visible slot')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.app-shell').classList.contains('is-search-open'))
    assert.ok(Math.abs((await reveal(0.5)).bottom - 960) < 1, 'Closing search restores the fixed reveal')

    await reveal(0)
    await page.locator('main a').last().focus()
    await page.keyboard.press('Tab')
    await page.waitForFunction(() => document.activeElement === document.querySelector('.footer-nav .footer-link'))
    assert.ok(await page.locator('.footer-shell').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight + 1), 'Tab navigation exposes links behind the clip')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('.footer-shell').dataset.reveal === 'false')
    await reveal(0.5)
    assert.equal(await page.locator('.footer-surface').evaluate(element => getComputedStyle(element).transform), 'none')
    assert.equal(await page.locator('.footer-surface').evaluate(element => getComputedStyle(element).position), 'relative')
    assert.equal(await page.locator('.footer-surface').evaluate(element => getComputedStyle(element, '::after').content), 'none')
    await checkBelowPaper()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 390, height: 300 })
    await page.waitForFunction(() => document.querySelector('.footer-shell').dataset.reveal === 'false')
    assert.equal(await page.locator('.footer-surface').evaluate(element => getComputedStyle(element).transform), 'none')
    for (const label of ['Home', 'Contact', 'GitHub']) {
      const link = page.locator('.footer-nav').getByRole('link', { name: label, exact: true })
      // Home may still hold focus from the Tab check before the viewport resize.
      await page.locator('main').focus()
      await link.focus()
      await page.waitForFunction(() => {
        const bounds = document.activeElement.getBoundingClientRect()
        return bounds.top >= 0 && bounds.bottom <= innerHeight
      })
      assert.ok(await link.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        return bounds.top >= 0 && bounds.bottom <= innerHeight
      }), 'Tall footer links remain reachable in a short viewport')
    }
    assert.deepEqual(errors, [])
    report('Keyboard navigation, reduced motion and footers taller than the viewport remain accessible')
  } finally {
    await context.close()
  }
}

async function runFooterTopNavigationChecks(browser, baseURL, report) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    // Route layout must be correct even if an offscreen resize notification is not delivered.
    const NativeResizeObserver = window.ResizeObserver
    window.ResizeObserver = class extends NativeResizeObserver {
      observe(target, options) {
        if (!target.matches('.footer-surface')) super.observe(target, options)
      }
    }
  })
  const page = await context.newPage()
  try {
    for (const width of [1920, 390]) {
      await page.setViewportSize({ width, height: 1080 })
      const routes = width === 1920 ? ['home/', 'learning/', 'projects/', 'contact/'] : ['contact/']
      for (const route of routes) {
        await page.goto(new URL(route, baseURL).href)
        await page.locator('.footer-shell[data-reveal]').waitFor({ state: 'attached' })
        await page.evaluate(() => document.fonts.ready)
        const footer = await page.locator('.footer-shell').elementHandle()
        if (width === 1920) {
          await page.locator('.nav-desktop-list').getByRole('link', { name: '关于', exact: true }).click()
        } else {
          await page.getByRole('button', { name: '打开导航菜单', exact: true }).click()
          await page.getByRole('button', { name: '关于', exact: true }).click()
          await page.getByRole('link', { name: '更多关于我', exact: true }).click()
        }
        await page.waitForURL(new URL('about/', baseURL).href)
        await page.locator('.journey-closing-note').waitFor({ state: 'attached' })
        const atTop = await footer.evaluate(element => {
          const slot = element.getBoundingClientRect()
          const surface = element.querySelector('.footer-surface').getBoundingClientRect()
          return { connected: element.isConnected, scroll: scrollY, offscreen: slot.top > innerHeight, reserved: slot.height, actual: surface.height }
        })
        assert.ok(atTop.connected && atTop.offscreen && atTop.scroll < 1, 'Top navigation changes pages while the shared footer remains offscreen')
        assert.ok(Math.abs(atTop.reserved - atTop.actual) < 1, `Top navigation from ${route} reserves the entire About footer before scrolling`)
        await page.mouse.move(width / 2, 400)
        await page.mouse.wheel(0, 30000)
        await page.waitForFunction(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 1)
        const clippedTop = await footer.evaluate(element => element.getBoundingClientRect().top - element.querySelector('.footer-surface').getBoundingClientRect().top)
        assert.ok(Math.abs(clippedTop) < 1, 'A wheel scroll reaches the full footer without refreshing or focusing a footer link')
      }
    }
    report('Desktop and mobile top navigation reserve the full footer even without resize notifications')
  } finally {
    await context.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.FOOTER_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runFooterRevealChecks(browser, process.env.FOOTER_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Footer reveal checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
