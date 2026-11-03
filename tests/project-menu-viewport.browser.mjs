import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const trigger = page => page.getByRole('button', { name: 'Open menu', exact: true })
const frames = (page, count = 3) => page.evaluate(count => new Promise(resolve => {
  const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick)
  requestAnimationFrame(tick)
}), count)
const startProbe = page => page.evaluate(() => {
  const probe = window.menuViewportProbe = { samples: [], frame: 0 }
  const sample = () => {
    const button = document.querySelector('button[aria-label="Open menu"]')
    const rect = button.getBoundingClientRect()
    probe.samples.push({ y: rect.y, bottom: rect.bottom, height: innerHeight, scroll: document.getElementById('site-scroll').scrollTop,
      body: document.querySelector('.project-reader-scroll')?.scrollTop ?? 0 })
    probe.frame = requestAnimationFrame(sample)
  }
  sample()
})
const stopProbe = page => page.evaluate(() => {
  cancelAnimationFrame(window.menuViewportProbe.frame)
  return window.menuViewportProbe.samples
})
const assertAnchored = (samples, inset = 24) => {
  assert.ok(samples.length > 2, 'Observe the control across multiple animation frames')
  assert.ok(samples.every(sample => Math.abs(sample.bottom - (sample.height - inset)) < .1),
    'Every frame keeps the native bottom inset without delayed catch-up motion')
}

async function assertReaderMenuPaintIsStable(page, baseURL) {
  for (const route of ['projects/personal-website/', 'projects/triton-attention-optimization/#project-sparsity']) {
    await page.goto(new URL(route, baseURL).href)
    await trigger(page).waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => !document.querySelector('.project-page-transition[open]'))
    await page.locator('#site-scroll').evaluate(element => element.scrollTo({ top: 0, behavior: 'instant' }))
    await frames(page)
    const initial = await trigger(page).boundingBox()
    const clip = { x: Math.floor(initial.x) - 2, y: Math.floor(initial.y) - 2,
      width: Math.ceil(initial.width) + 4, height: Math.ceil(initial.height) + 4 }
    const pixels = async () => sharp(await page.screenshot({ clip, scale: 'css' })).removeAlpha().raw().toBuffer()
    const reference = await pixels()
    assert.ok(reference.some(channel => channel < 100), 'The menu comparison includes visible text and its icon')
    const positions = []

    // Desktop WebKit cannot reproduce iOS momentum compositing. Move content and
    // frame layers independently to ensure none can carry the fixed menu with them.
    // Pixel comparisons also catch clipping and painting changes missed by rects.
    for (const selector of ['#site-scroll', '.project-reader', '#root']) {
      try {
        for (const [top, offset] of [[120, -7], [300, 6], [80, -4], [0, 0]]) {
          await page.locator(selector).evaluate((element, offset) => {
            element.style.transform = `translate3d(0, ${offset}px, 0)`
          }, offset)
          positions.push(await page.evaluate(top => {
            const scroller = document.getElementById('site-scroll')
            scroller.scrollTo({ top, behavior: 'instant' })
            document.querySelector('.project-reader-scroll').scrollTop = top
            return scroller.scrollTop
          }, top))
          await frames(page)
          const current = await trigger(page).boundingBox()
          assert.ok(Math.abs(current.y - initial.y) < .1 && Math.abs(current.x - initial.x) < .1,
            `${route}: moving ${selector} must not displace the menu (${initial.x}, ${initial.y} -> ${current.x}, ${current.y})`)
          assert.ok(reference.equals(await pixels()),
            `${route}: the painted menu must not shift, clip or smear with the scrolling content`)
        }
      } finally {
        await page.locator(selector).evaluate(element => element.style.removeProperty('transform'))
      }
    }
    assert.ok(new Set(positions).size > 1, 'The content actually scrolls during the menu paint checks')
  }
}

export async function runProjectMenuViewportChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await assertReaderMenuPaintIsStable(page, baseURL)
    report('Reader menu pixels remain unchanged when content and outer frame layers move independently')
    await page.goto(new URL('projects/triton-attention-optimization/#project-sparsity', baseURL).href)
    await trigger(page).waitFor()
    await page.evaluate(() => document.fonts.ready)
    await frames(page)
    await startProbe(page)
    await page.evaluate(async () => {
      const article = document.querySelector('.project-reader-scroll')
      for (const top of [0, 80, 200, 120, 0]) {
        document.getElementById('site-scroll').scrollTo({ top, behavior: 'instant' })
        article.scrollTop = top
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
    })
    if (browser.browserType().name() === 'chromium') {
      const session = await context.newCDPSession(page)
      const bounds = await trigger(page).boundingBox()
      const crop = { left: Math.floor(bounds.x) - 2, top: Math.floor(bounds.y) - 2,
        width: Math.ceil(bounds.width) + 4, height: Math.ceil(bounds.height) + 4 }
      const painted = [], acknowledgements = []
      session.on('Page.screencastFrame', event => {
        painted.push(Buffer.from(event.data, 'base64'))
        acknowledgements.push(session.send('Page.screencastFrameAck', { sessionId: event.sessionId }))
      })
      try {
        await session.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
        for (const [start, end] of [[600, 180], [180, 600], [580, 200], [200, 580]]) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 380, y: start, id: 0 }] })
          for (let step = 1; step <= 20; step++) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 380, y: start + (end - start) * step / 20, id: 0 }] })
            await frames(page, 1)
          }
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
          await frames(page, 10)
        }
        await session.send('Page.stopScreencast')
        await Promise.all(acknowledgements)
        assert.ok(painted.length >= 20, 'Capture compositor frames throughout rapid native touch scrolling and reversals')
        const reference = await sharp(painted[0]).extract(crop).removeAlpha().raw().toBuffer()
        for (const screenshot of painted) {
          const pixels = await sharp(screenshot).extract(crop).removeAlpha().raw().toBuffer()
          assert.ok(reference.equals(pixels), 'Every captured touch-scroll frame paints the menu in exactly the same pixels')
        }
        report(`${painted.length} compositor frames keep identical menu pixels during rapid touch scrolling and reversals`)
      } finally {
        await session.detach()
      }
    }
    const scrolling = await stopProbe(page)
    assertAnchored(scrolling)
    assert.ok(new Set(scrolling.map(sample => sample.scroll)).size > 1)
    assert.ok(new Set(scrolling.map(sample => sample.body)).size > 1)
    report('Document and article scrolling keep the menu anchored to the screen')

    // Desktop emulation has no Safari toolbar or rubber-band gesture. Model its
    // transient visual-viewport reports independently of the fixed containing block.
    for (const route of ['projects/triton-attention-optimization/', 'projects/']) {
      await page.goto(new URL(route, baseURL).href)
      await trigger(page).waitFor()
      await page.evaluate(() => document.fonts.ready)
      await frames(page)
      await startProbe(page)
      await page.evaluate(async () => {
        const viewport = visualViewport
        const initialHeight = viewport.height
        const initialOffset = viewport.offsetTop
        try {
          for (const [heightDelta, offset] of [[0, -12], [0, 8], [-40, 0], [-24, 6], [-64, 0], [-32, -5], [0, 0]]) {
            Object.defineProperty(viewport, 'height', { configurable: true, value: initialHeight + heightDelta })
            Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: initialOffset + offset })
            viewport.dispatchEvent(new Event('resize'))
            viewport.dispatchEvent(new Event('scroll'))
            window.dispatchEvent(new Event('resize'))
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          }
        } finally {
          delete viewport.height
          delete viewport.offsetTop
          viewport.dispatchEvent(new Event('resize'))
          viewport.dispatchEvent(new Event('scroll'))
        }
      })
      await frames(page, 12)
      assertAnchored(await stopProbe(page))
    }
    report('Transient visual-viewport offsets and resize reversals cannot add menu motion on reader or archive pages')

    await startProbe(page)
    for (const height of [820, 780, 800, 844, 760, 844]) {
      await page.setViewportSize({ width: 390, height })
      await frames(page, 3)
    }
    assertAnchored(await stopProbe(page))
    report('Actual viewport resizing preserves the bottom inset on every frame without a settling animation')

    await page.locator('.projects-archive').evaluate(archive => archive.style.setProperty('--archive-safe-bottom', '34px'))
    await startProbe(page)
    await frames(page, 3)
    await page.setViewportSize({ width: 844, height: 390 })
    await frames(page, 3)
    assertAnchored(await stopProbe(page), 34)
    await page.locator('.projects-archive').evaluate(archive => archive.style.removeProperty('--archive-safe-bottom'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startProbe(page)
    await page.setViewportSize({ width: 844, height: 350 })
    await frames(page, 3)
    assertAnchored(await stopProbe(page))
    report('Landscape rotation, safe-area insets and reduced motion retain correct native positioning')

    for (const route of ['projects/', 'projects/triton-attention-optimization/']) {
      await page.goto(new URL(route, baseURL).href)
      await trigger(page).waitFor()
      await trigger(page).tap()
      await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'open')
      const close = page.getByRole('button', { name: 'Close menu', exact: true })
      assert.ok(await close.evaluate(button => Math.abs(innerHeight - button.getBoundingClientRect().bottom - 24) < .1))
      await close.tap()
      await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'closed')
      // Safari taps do not establish button focus. Check focus restoration with
      // keyboard activation separately from the touch open/close interaction.
      await trigger(page).focus()
      await trigger(page).press('Enter')
      await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'open')
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'closed')
      assert.ok(await trigger(page).evaluate(button => button === document.activeElement))
    }
    report('Reader and archive menus open, close and restore focus correctly')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const playwright = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const engine = process.env.PROJECTS_BROWSER_ENGINE || 'chromium'
  const browser = await playwright[engine].launch({ ...(engine === 'chromium' ? { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge' } : {}), headless: true })
  try {
    await runProjectMenuViewportChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Project menu viewport checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
