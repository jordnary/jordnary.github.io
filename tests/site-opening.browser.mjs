import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const opening = '.site-opening'
const finished = page => page.locator(opening).waitFor({ state: 'detached', timeout: 10000 })
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

export async function runSiteOpeningChecks(browser, baseURL, report = () => {}) {
  let passed = 0
  const pass = name => { passed++; report(name) }
  const output = 'node_modules/.cache/site-opening'
  await mkdir(output, { recursive: true })
  const setup = async (options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    return { context, page, errors }
  }

  for (const asset of ['opening-symbol.png', 'fonts/opening-archivo-black.woff2']) {
    const { context, page } = await setup()
    try {
      let release
      const held = new Promise(resolve => { release = resolve })
      await page.route(`**/${asset}`, async route => { await held; await route.continue() })
      const requested = page.waitForRequest(`**/${asset}`)
      await page.goto(baseURL, { waitUntil: 'commit' })
      await requested
      await page.waitForTimeout(250)
      assert.equal(await page.locator(opening).getAttribute('data-state'), null)
      release()
      await page.locator(`${opening}[data-state="playing"]`).waitFor()
    } finally { await context.close() }
    pass(`The opening waits for a delayed ${asset} before starting its timeline`)
  }

  // Hold every entry script and sheet, including preloaded route chunks. The
  // reference animation must be visibly painting without the application.
  for (const extension of ['js', 'css']) {
    const { context, page, errors } = await setup()
    const held = []
    let released = false
    try {
      await page.route(new RegExp(`/assets/[^/]+\\.${extension}(?:\\?.*)?$`), route => {
        if (released) return route.continue()
        held.push(route)
      })
      await page.goto(baseURL, { waitUntil: 'commit' })
      await page.locator(`${opening}[data-state="playing"]`).waitFor()
      await page.waitForFunction(() => performance.getEntriesByType('paint').length > 0)
      await page.waitForFunction(() => [...document.querySelectorAll('.site-opening-echo')]
        .some(element => Number(getComputedStyle(element).opacity) > 0.05))
      const state = await page.evaluate(() => ({
        background: getComputedStyle(document.querySelector('.site-opening')).backgroundColor,
        color: getComputedStyle(document.querySelector('.site-opening')).color,
        modal: document.querySelector('.site-opening').matches(':modal'),
        portal: Boolean(document.querySelector('.homepage-portal')),
      }))
      assert.equal(state.background, 'rgb(255, 255, 255)')
      assert.equal(state.color, 'rgb(13, 13, 13)')
      assert.equal(state.modal, true)
      assert.equal(state.portal, false)
      assert.ok(held.length > 0, 'Entry requests run concurrently with the opening')
      await page.screenshot({ path: `${output}/held-${extension}.png` })
      if (extension === 'js') {
        const samples = await page.locator('.site-opening-lockup').evaluate(lockup => {
          const animations = lockup.getAnimations({ subtree: true })
          const saved = animations.map(animation => animation.currentTime)
          const face = lockup.querySelector('.site-opening-face')
          const echoes = [...lockup.querySelectorAll('.site-opening-echo')]
          const samples = [100, 365, 620, 1250, 2100, 2230, 2400].map(time => {
            for (const animation of animations) animation.currentTime = time
            const box = face.getBoundingClientRect()
            return {
              opacity: Number(getComputedStyle(lockup).opacity),
              width: box.width,
              center: box.left + box.width / 2,
              shadows: echoes.filter(echo => Number(getComputedStyle(echo).opacity) > 0.01)
                .map(echo => echo.getBoundingClientRect().bottom - box.bottom),
            }
          })
          animations.forEach((animation, index) => { animation.currentTime = saved[index] })
          return samples
        })
        const [entering, full, turning, projected, overshoot, undershoot, rest] = samples
        assert.ok(entering.opacity > 0 && entering.opacity < full.opacity && full.opacity === 1)
        assert.ok(projected.width < full.width * 0.8 && projected.center < full.center)
        assert.ok(turning.shadows.length > 0 && turning.shadows.length < projected.shadows.length)
        assert.ok(projected.shadows.every((offset, i, offsets) => offset > 0 && (!i || offset < offsets[i - 1])))
        assert.equal(overshoot.shadows.length, 0)
        assert.ok(overshoot.width > full.width * 1.04 && undershoot.width < full.width)
        assert.ok(Math.abs(rest.width - full.width) < 1)
        const fullScreenSize = await page.evaluate(() => Math.max(35, Math.min(120, screen.width * 0.047)))
        for (const [width, height] of [[1920, 900], [1024, 620], [880, 390], [390, 844], [320, 190]]) {
          await page.setViewportSize({ width, height })
          const layout = await page.locator('.site-opening-lockup').evaluate(lockup => {
            const animations = lockup.getAnimations({ subtree: true })
            const saved = animations.map(animation => animation.currentTime)
            const fits = [0, 620, 1250, 1900, 2100, 2400].every(time => {
              animations.forEach(animation => { animation.currentTime = time })
              return [...lockup.children].filter(el => Number(getComputedStyle(el).opacity) > 0).every(el => {
                const box = el.getBoundingClientRect()
                return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
              })
            })
            animations.forEach((animation, index) => { animation.currentTime = saved[index] })
            return { fits, size: parseFloat(getComputedStyle(lockup).fontSize) }
          })
          assert.ok(layout.fits, `The moving face and echoes fit at ${width} × ${height}`)
          if (width >= 880) assert.ok(Math.abs(layout.size - fullScreenSize) < 0.01)
          else assert.ok(layout.size < fullScreenSize)
        }
        await page.setViewportSize({ width: 1440, height: 900 })
      }
      await page.waitForTimeout(2400)
      assert.equal(await page.locator(opening).getAttribute('data-state'), 'playing', 'Wait for real content after the visual timeline')
      await page.keyboard.press('Escape')
      assert.equal(await page.locator(opening).count(), 1, 'Skipping must not expose an unloaded page')
      released = true
      await Promise.all(held.splice(0).map(route => route.continue()))
      await page.waitForFunction(() => document.querySelector('.site-opening')?.dataset.state === 'revealing')
      if (extension === 'js') {
        const { opacity, curtainAtStart, curtainAtFadeEnd } = await page.locator('.site-opening-logo').evaluate(logo => {
          const [fade] = logo.getAnimations()
          const overlay = logo.closest('.site-opening')
          const [curtain] = overlay.getAnimations()
          const savedFade = fade.currentTime
          const savedCurtain = curtain.currentTime
          const duration = fade.effect.getComputedTiming().activeDuration
          const opacity = [0, 0.25, 0.75, 1].map(fraction => {
            fade.currentTime = duration * fraction
            return Number(getComputedStyle(logo).opacity)
          })
          curtain.currentTime = 0
          const curtainAtStart = getComputedStyle(overlay).clipPath
          curtain.currentTime = duration
          const curtainAtFadeEnd = getComputedStyle(overlay).clipPath
          fade.currentTime = savedFade
          curtain.currentTime = savedCurtain
          return { opacity, curtainAtStart, curtainAtFadeEnd }
        })
        assert.ok(opacity[0] === 1 && opacity[1] < 1 && opacity[1] > opacity[2] && opacity[2] > 0 && opacity[3] === 0)
        assert.equal(curtainAtFadeEnd, curtainAtStart, 'The curtain stays fully open until the wordmark is invisible')
      }
      assert.equal(await page.locator('.launch-intro-content').evaluate(element => getComputedStyle(element).opacity), '1', 'Late routes also reveal fully prepared text')
      await finished(page)
      await page.locator('.launch-intro-enter').waitFor()
      assert.equal(await page.evaluate(() => window.__siteOpening.status), 'complete')
      assert.deepEqual(errors, [])
      pass(`Opening paints with delayed ${extension.toUpperCase()}, loads concurrently, and reveals only after content is ready`)
    } finally { await context.close() }
  }

  for (const [name, settings] of [
    ['desktop', {}],
    ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
    ['landscape', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    const { context, page, errors } = await setup(settings)
    try {
      await page.goto(baseURL)
      await page.locator('.homepage-portal').waitFor()
      assert.equal(await page.locator(opening).count(), 1, 'The route is prepared under the curtain')
      assert.equal(await page.locator('.launch-intro').getAttribute('data-running'), 'false')
      await page.keyboard.press('Enter')
      await page.mouse.wheel(0, 200)
      assert.equal(await page.locator('.homepage-portal').getAttribute('data-phase'), 'intro')
      await page.waitForFunction(() => [...document.querySelectorAll('.site-opening-echo')]
        .some(element => Number(getComputedStyle(element).opacity) > 0.1))
      const fits = await page.locator('.site-opening-lockup').evaluate(element => {
        const box = element.getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth && box.top > 0 && box.bottom < innerHeight
      })
      assert.ok(fits, 'The complete wordmark fits the viewport')
      const [reveal] = await Promise.all([
        page.waitForFunction(() => {
          if (document.querySelector('.site-opening')?.dataset.state !== 'revealing') return false
          const center = selector => {
            const box = document.querySelector(selector).getBoundingClientRect()
            return box.top + box.height / 2
          }
          return {
            offset: center('.site-opening-face .site-opening-name') - center('#launch-intro-title'),
            opacity: getComputedStyle(document.querySelector('.launch-intro-content')).opacity,
          }
        }),
        page.screenshot({ path: `${output}/${name}-echo.png` }),
      ])
      const { offset, opacity } = await reveal.jsonValue()
      assert.ok(Math.abs(offset) <= 6, `Opening and intro title centers align within 6px (offset ${offset})`)
      assert.equal(opacity, '1')
      await finished(page)
      await frame(page)
      assert.equal(await page.locator('.launch-intro').getAttribute('data-running'), 'true')
      assert.equal(await page.locator(':modal').count(), 0)
      await page.keyboard.press('Enter')
      await page.locator('.homepage-portal[data-phase="hub"]').waitFor()
      assert.equal(await page.locator('.homepage-portal-hub').evaluate(element => element.inert), false)
      if (name === 'desktop') {
        await page.locator('.homepage-hub-link[href$="/home/"]').click()
        await page.locator('.home-editorial').waitFor()
        await page.goBack()
        await page.locator(`${opening}[data-state="playing"]`).waitFor()
        await page.goForward()
        await page.locator('.home-editorial').waitFor()
        assert.equal(await page.locator(opening).count(), 0, 'Leaving during a replay releases the dialog')
        await page.goBack()
        await page.locator(`${opening}[data-state="playing"]`).waitFor()
        await finished(page)
        await page.locator('.launch-intro-enter').waitFor()
        await page.reload()
        await page.locator(opening).waitFor()
        await finished(page)
      }
      assert.deepEqual(errors, [])
      pass(`${name}: typography fits, content loads behind the animation, and input works after the curtain leaves`)
    } finally { await context.close() }
  }

  for (const mode of ['reduce', 'changed', 'font-error', 'entry-error', 'hidden', 'watchdog']) {
    const { context, page, errors } = await setup(mode === 'reduce' ? { reducedMotion: 'reduce' } : {})
    try {
      if (mode === 'font-error') await page.route('**/fonts/opening-archivo-black.woff2', route => route.abort())
      if (mode === 'entry-error') await page.route(/\/assets\/main-[^/]+\.js$/, route => route.abort())
      if (mode === 'watchdog') await page.route(/\/assets\/main-[^/]+\.js$/, () => {})
      await page.goto(baseURL, { waitUntil: mode.endsWith('error') || mode === 'watchdog' ? 'commit' : 'load' })
      if (mode === 'changed') {
        await page.locator(opening).waitFor()
        await page.emulateMedia({ reducedMotion: 'reduce' })
      }
      if (mode === 'hidden') {
        await page.locator(opening).waitFor()
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true })
          document.dispatchEvent(new Event('visibilitychange'))
          delete document.hidden
        })
      }
      if (mode === 'font-error') {
        await page.locator(`${opening}[data-state="playing"]`).waitFor()
        assert.match(await page.locator('.site-opening-logo').evaluate(element => getComputedStyle(element).fontFamily), /Arial Black/)
      }
      if (mode === 'entry-error' || mode === 'watchdog') await page.locator('.page-load-feedback').waitFor({ timeout: 10000 })
      await finished(page)
      if (mode !== 'reduce') assert.equal(await page.evaluate(() => window.__siteOpening.status), 'complete')
      if (!['entry-error', 'watchdog'].includes(mode)) await page.locator('.launch-intro-enter').waitFor()
      assert.equal(await page.locator(':modal').count(), 0)
      assert.deepEqual(errors, [])
      pass(`${mode}: cleanup releases the page without a stuck modal`)
    } finally { await context.close() }
  }

  const { context, page, errors } = await setup()
  try {
    await page.goto(new URL('home/', baseURL).href)
    await page.locator('.home-editorial').waitFor()
    assert.equal(await page.locator('[data-site-opening]').count(), 0)
    assert.equal(await page.locator('link[data-opening-styles]').count(), 0)
    await page.getByRole('link', { name: 'Jordnary', exact: true }).click()
    await page.locator(`${opening}[data-state="playing"]`).waitFor()
    const icon = await page.locator('.site-opening-face .site-opening-symbol').evaluate(el => getComputedStyle(el, '::before').maskImage)
    const maskURL = new URL('opening-symbol.png', baseURL).href
    assert.ok(icon.includes(maskURL))
    const response = await page.request.get(maskURL)
    assert.ok(response.ok())
    const { data, info } = await sharp(await response.body()).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })
    // Follow both stems across the underside of the JT crossbar.
    for (const x of [236, 302]) {
      for (let y = 239; y <= 249; y++) {
        assert.ok(data[y * info.width + x] >= 248, `Gap at the crossbar joint (${x}, ${y})`)
      }
    }
    await finished(page)
    await page.locator('.launch-intro-enter').waitFor()
    assert.deepEqual(errors, [])
    pass('Direct content-page visits play the opening when the brand link returns to the root')
  } finally { await context.close() }
  return passed
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ channel: process.env.HOMEPAGE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try {
    const passed = await runSiteOpeningChecks(browser, process.env.HOMEPAGE_TEST_URL || 'http://127.0.0.1:4174/', name => console.log(`PASS: ${name}`))
    console.log(`${passed} opening checks passed`)
  } catch (error) { console.error(`Opening regression failed: ${error.message}`); process.exitCode = 1 }
  finally { await browser.close() }
}
