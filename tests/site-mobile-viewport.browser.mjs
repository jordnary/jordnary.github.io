import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const frames = (page, count = 3) => page.evaluate(count => new Promise(resolve => {
  const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick)
  requestAnimationFrame(tick)
}), count)
const scrollTo = (page, top) => page.locator('#site-scroll').evaluate((element, top) => {
  element.scrollTo({ top: top === 'end' ? element.scrollHeight : top, behavior: 'instant' })
}, top)

async function expectPaperOutsideFrame(page) {
  const { data, info } = await sharp(await page.screenshot()).extract({ left: 0, top: 710, width: 390, height: 120 }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let offset = 0; offset < data.length; offset += info.channels) {
    assert.ok(data[offset] >= 240 && data[offset + 1] >= 240 && data[offset + 2] >= 240,
      'No text, artwork or menu pixels can escape the stationary frame')
  }
}

export async function runSiteMobileViewportChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    for (const route of ['projects/', 'home/', 'about/', 'learning/', 'contact/', 'projects/studio/', 'projects/triton-attention-optimization/', '']) {
      const response = await page.goto(new URL(route, baseURL).href)
      const html = await response.text()
      assert.match(html, /name="viewport" content="[^"]*viewport-fit=contain/)
      assert.match(html, /<link[^>]+rel="stylesheet"/, 'The initial HTML loads render-blocking styles before the application')
      await page.locator('main').waitFor({ state: 'attached' })
      if (!route) await page.locator('.homepage-portal').waitFor()
      await frames(page)
      const initial = await page.locator('#root').boundingBox()
      await scrollTo(page, 'end')
      await frames(page)
      const state = await page.evaluate(() => {
        const scroller = document.getElementById('site-scroll')
        return { windowTop: scrollY, bodyTop: document.body.scrollTop, top: scroller.scrollTop,
          max: scroller.scrollHeight - scroller.clientHeight,
          documentHeight: document.documentElement.scrollHeight, height: innerHeight,
          clip: getComputedStyle(document.getElementById('root')).clipPath,
          overflow: document.documentElement.scrollWidth > innerWidth }
      })
      assert.equal(state.windowTop, 0, `${route}: the browser document stays stationary`)
      assert.equal(state.bodyTop, 0)
      assert.equal(state.overflow, false)
      assert.ok(state.documentHeight <= state.height + 1)
      assert.equal(state.clip, 'inset(0px)')
      if (route) assert.ok(Math.abs(state.top - state.max) < 2, `${route}: the page end remains reachable`)
      assert.deepEqual(await page.locator('#root').boundingBox(), initial)
      if (['home/', 'about/', 'learning/', 'contact/'].includes(route)) {
        await page.getByRole('button', { name: '打开导航菜单', exact: true }).tap()
        const dialog = page.getByRole('dialog', { name: '全站导航', exact: true })
        await dialog.waitFor()
        assert.equal((await dialog.boundingBox()).height, initial.height)
        await page.getByRole('button', { name: '关闭导航菜单', exact: true }).tap()
        await page.waitForFunction(() => !document.querySelector('.mobile-nav-dialog[open]'))
        assert.ok(Math.abs(await page.locator('#site-scroll').evaluate(element => element.scrollTop) - state.top) < 2,
          `${route}: opening the menu at the page end preserves the reading position`)
      }
      report(`${route || 'portal'}: stationary outer viewport and reachable page content`)
    }

    await page.goto(new URL('projects/', baseURL).href)
    const menu = page.getByRole('button', { name: 'Open menu', exact: true })
    await menu.waitFor()
    await page.evaluate(() => document.fonts.ready)
    // Desktop engines do not render an iPhone toolbar. Model a small viewport
    // within a taller layout viewport, then exercise real scrolling and hit testing.
    await page.addStyleTag({ content: ':root { --site-viewport-height: 700px; }' })
    const menuBounds = await menu.boundingBox()
    assert.ok(Math.abs(menuBounds.y + menuBounds.height - 676) < 1)
    assert.equal(await page.locator('.archive-footer-mask').count(), 0)
    for (const top of [0, 120, 260, 'end', 80, 0]) {
      await scrollTo(page, top)
      await frames(page)
      assert.deepEqual(await menu.boundingBox(), menuBounds, 'Scrolling never moves the menu')
      assert.equal(await page.evaluate(() => scrollY), 0)
      assert.ok(await page.evaluate(() => !document.elementFromPoint(220, 740)?.closest('#root')))
      await expectPaperOutsideFrame(page)
    }
    report('Text, background and menu share one clipped frame throughout scrolling')

    // Transient browser viewport reports must not move the stable page frame.
    await page.evaluate(async () => {
      const viewport = visualViewport
      try {
        for (const [height, offsetTop] of [[700, 0], [780, 8], [844, 0], [730, -8], [700, 0]]) {
          Object.defineProperty(viewport, 'height', { configurable: true, value: height })
          Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: offsetTop })
          viewport.dispatchEvent(new Event('resize'))
          viewport.dispatchEvent(new Event('scroll'))
          window.dispatchEvent(new Event('resize'))
          await new Promise(resolve => requestAnimationFrame(resolve))
        }
      } finally {
        delete viewport.height
        delete viewport.offsetTop
      }
    })
    assert.deepEqual(await menu.boundingBox(), menuBounds)
    await menu.tap()
    await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'open')
    const close = page.getByRole('button', { name: 'Close menu', exact: true })
    const closeBounds = await close.boundingBox()
    assert.ok(Math.abs(closeBounds.y + closeBounds.height - 676) < 1)
    await expectPaperOutsideFrame(page)
    await close.tap()
    await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'closed')
    await page.getByRole('button', { name: 'Visual', exact: true }).tap()
    await page.waitForFunction(() => document.querySelectorAll('.archive-project').length === 1)
    assert.equal(await page.locator('#site-scroll').evaluate(element => element.scrollTop), 0)
    await page.getByRole('button', { name: 'All', exact: true }).tap()
    await page.waitForFunction(() => document.querySelectorAll('.archive-project').length > 1)
    await scrollTo(page, 140)
    await page.evaluate(() => document.addEventListener('click', () => {
      window.scrollAtNavigation = document.getElementById('site-scroll').scrollTop
    }, { once: true, capture: true }))
    await page.locator('.archive-project-link').nth(1).tap()
    await page.locator('.project-reader').waitFor()
    const before = await page.evaluate(() => window.scrollAtNavigation)
    await page.goBack()
    await page.locator('.archive-list').waitFor()
    await page.waitForFunction(top => Math.abs(document.getElementById('site-scroll').scrollTop - top) < 2, before)
    report('Viewport reports, menu controls, filters and Back preserve the stationary frame and scroll state')

    // Observe every frame while deferred modules delay reload. This checks the
    // real initial HTML/CSS boundary rather than only a mounted React component.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.addInitScript(() => {
      window.viewportSamples = []
      const sample = () => {
        const root = document.getElementById('root')
        if (root) window.viewportSamples.push({ height: root.getBoundingClientRect().height,
          clip: getComputedStyle(root).clipPath, scroll: scrollY })
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const entryScript = '**/{src/main.tsx*,assets/main-*.js}'
    await page.route(entryScript, async route => {
      await new Promise(resolve => setTimeout(resolve, 350))
      await route.continue()
    })
    await page.reload()
    await page.locator('.archive-list').waitFor()
    await page.waitForFunction(() => !document.querySelector('.project-page-transition[open]'))
    const samples = await page.evaluate(() => window.viewportSamples)
    assert.ok(samples.length > 4)
    assert.ok(samples.every(sample => sample.clip === 'inset(0px)' && sample.scroll === 0 && Math.abs(sample.height - 844) < 1))
    await page.unroute(entryScript)
    for (const [width, height] of [[844, 390], [320, 568], [430, 932]]) {
      await page.setViewportSize({ width, height })
      await frames(page)
      const frame = await page.locator('#root').boundingBox()
      const button = await menu.boundingBox()
      assert.equal(frame.height, height)
      assert.ok(button.y >= 0 && button.y + button.height <= frame.height)
      await menu.tap()
      await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'open')
      await close.tap()
      await page.waitForFunction(() => document.querySelector('.archive-menu').dataset.state === 'closed')
    }
    report('Cold reload, transition overlays, portrait and landscape keep content inside the frame')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const playwright = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const engine = process.env.PROJECTS_BROWSER_ENGINE || 'chromium'
  const browser = await playwright[engine].launch({ ...(engine === 'chromium' ? { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge' } : {}), headless: true })
  try {
    await runSiteMobileViewportChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Site mobile viewport checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
