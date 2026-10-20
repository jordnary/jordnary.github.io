import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const output = 'node_modules/.cache/home-gallery'

export async function runHomePhotoGalleryChecks(browser, baseURL, report = () => {}) {
  await mkdir(output, { recursive: true })
  const homeURL = new URL('home/', baseURL).href
  const center = async (page, index) => {
    await page.waitForFunction(expected => {
      const rail = document.querySelector('.home-gallery')
      const card = rail.children[expected]
      const bounds = card.getBoundingClientRect()
      const container = rail.getBoundingClientRect()
      return !rail.hasAttribute('data-moving') && card.dataset.centered === 'true' &&
        Math.abs(bounds.left + bounds.width / 2 - container.left - container.width / 2) < 2
    }, index)
    await page.evaluate(() => new Promise((resolve, reject) => {
      const rail = document.querySelector('.home-gallery')
      let previous = rail.scrollLeft
      let stable = 0
      const deadline = performance.now() + 5000
      const tick = () => {
        stable = Math.abs(rail.scrollLeft - previous) < .1 ? stable + 1 : 0
        previous = rail.scrollLeft
        if (stable >= 4) resolve()
        else if (performance.now() > deadline) reject(new Error('The gallery must settle after navigation'))
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }))
  }
  const open = async page => {
    await page.goto(homeURL)
    await page.locator('.home-gallery').scrollIntoViewIfNeeded()
    await page.locator('.home-gallery img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode() })))
    await center(page, 0)
  }
  const drag = async (page, start, end, button = 'left') => {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down({ button })
    await page.mouse.move(end.x, end.y, { steps: 24 })
    // Release from a deliberate stop, independently of automation event cadence.
    await page.waitForTimeout(130)
    await page.mouse.up({ button })
  }

  for (const width of [320, 390, 768, 1440, 2558]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' })
    await context.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let phase = 'opening'
    try {
      report(`CHECK: ${width}px gallery interactions`)
      await open(page)
      const rail = page.locator('.home-gallery')
      assert.deepEqual(await page.locator('.home-gallery-caption').allTextContents(), ['About关于', 'Learning学习', 'Projects项目', 'Contact联系'])
      assert.equal(await page.locator('#selected button').count(), 0, 'The directory gallery has no surrounding action controls')
      assert.equal(await page.getByRole('heading', { name: 'The journal', exact: true }).count(), 1, 'The original journal remains unchanged')
      assert.equal(await page.locator('.home-editorial-journal-card').count(), 3)
      assert.equal(await page.locator('#selected').getByText('浏览全部项目', { exact: true }).count(), 0)
      assert.equal(await rail.locator('img').count(), 4)
      assert.ok(await rail.locator('img').evaluateAll(images => images.every(image => image.naturalWidth === 1536 && image.alt && new URL(image.src).pathname.includes('/images/home/'))))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))

      phase = 'hover'
      const card = await rail.locator('.home-gallery-card').first().boundingBox()
      const point = { x: card.x + card.width * .75, y: card.y + card.height * .4 }
      const readFeedback = () => rail.locator('.home-gallery-card').first().evaluate(element => {
        const scale = selector => new DOMMatrixReadOnly(getComputedStyle(element.querySelector(selector)).transform).a
        return {
          card: scale('.home-gallery-link'),
          image: scale('img'),
          line: scale('.home-gallery-line'),
        }
      })
      const caption = await rail.locator('.home-gallery-caption').first().evaluate(element => {
        const english = element.children[0].getBoundingClientRect()
        const chinese = element.children[1].getBoundingClientRect()
        return { englishBottom: english.bottom, chineseTop: chinese.top, leftDifference: Math.abs(english.left - chinese.left) }
      })
      assert.ok(caption.chineseTop > caption.englishBottom, 'The Chinese caption sits below the English title')
      assert.ok(caption.leftDifference < 1, 'Both caption lines share a left edge')
      await page.mouse.move(point.x, point.y)
      await page.waitForTimeout(900)
      const hover = await readFeedback()
      assert.ok(Math.abs(hover.card - .975) < .001, 'Hover gently contracts the entire card')
      assert.ok(Math.abs(hover.image - 1.075) < .001, 'The photograph enlarges inside its rounded frame')
      assert.ok(hover.line > 1.95, 'Hover extends the short line')
      assert.equal(await rail.evaluate(element => element.scrollLeft), 0, 'Hover never advances the rail')
      await page.mouse.move(4, card.y - 20)
      await page.waitForTimeout(900)
      assert.deepEqual(await readFeedback(), { card: 1, image: 1, line: 1 }, 'Leaving restores all layers')

      if (width === 1440) {
        phase = 'line thickness during transitions'
        const line = rail.locator('.home-gallery-line').first()
        const thickness = () => line.evaluate(element => element.getBoundingClientRect().height)
        const checkStroke = async (target, label) => {
          await line.evaluate(element => {
            window.homeGalleryStrokeTrace = { done: false, samples: [] }
            element.addEventListener('transitionrun', () => {
              const sample = () => {
                const moving = element.getAnimations().some(animation =>
                  animation instanceof CSSTransition && animation.transitionProperty === 'transform' && animation.playState === 'running')
                const cardScale = new DOMMatrixReadOnly(getComputedStyle(element.closest('.home-gallery-link')).transform).d
                window.homeGalleryStrokeTrace.samples.push({
                  moving,
                  thickness: element.getBoundingClientRect().height / cardScale,
                })
                if (moving) requestAnimationFrame(sample)
                else window.homeGalleryStrokeTrace.done = true
              }
              requestAnimationFrame(sample)
            }, { once: true })
          })
          await page.mouse.move(target.x, target.y)
          await page.waitForFunction(() => window.homeGalleryStrokeTrace.done)
          const samples = await page.evaluate(() => window.homeGalleryStrokeTrace.samples)
          const moving = samples.filter(sample => sample.moving)
          assert.ok(moving.length > 4, `${label}: sample the full stretch`)
          assert.ok(moving.every(sample => Math.abs(sample.thickness - 1) < .02), `${label}: the stroke is immediately thick and stays constant throughout motion`)
          assert.ok(Math.abs(samples.at(-1).thickness - .5) < .02, `${label}: completion immediately restores the fine stroke`)
        }
        await checkStroke(point, 'Extending')
        await checkStroke({ x: 4, y: card.y - 20 }, 'Retracting')

        phase = 'interrupted hover and keyboard focus'
        for (let repeat = 0; repeat < 4; repeat++) {
          await page.mouse.move(point.x, point.y)
          await page.waitForTimeout(70)
          await page.mouse.move(4, card.y - 20)
          await page.waitForTimeout(70)
        }
        await page.waitForTimeout(900)
        assert.deepEqual(await readFeedback(), { card: 1, image: 1, line: 1 }, 'Interrupted transitions settle without accumulating transforms')
        assert.ok(await thickness() <= 1.01, 'Interrupted transitions cannot leave a thick line')
        await rail.focus()
        await page.keyboard.press('Tab')
        assert.equal(await rail.locator('.home-gallery-link').first().evaluate(element => element.matches(':focus-visible')), true)
        await page.waitForTimeout(900)
        const focus = await readFeedback()
        assert.ok(focus.card < .98 && focus.image > 1.07 && focus.line > 1.95, 'Keyboard focus provides the same visual feedback')
        await rail.focus()
      }

      phase = 'mouse drag'
      await drag(page, point, { x: point.x - card.width * .3, y: point.y }, 'right')
      assert.equal(await rail.evaluate(element => element.scrollLeft), 0, 'Right-button dragging cannot move the gallery')
      phase = 'mouse drag'
      await drag(page, point, { x: point.x - card.width * .85, y: point.y })
      await center(page, 1)
      await page.waitForTimeout(700)
      const filters = await rail.locator('img').evaluateAll(images => images.map(image => ({ filter: getComputedStyle(image).filter, opacity: getComputedStyle(image).opacity })))
      assert.equal(filters[1].filter, 'grayscale(0)', 'The newly centered image restores its original colors')
      assert.equal(filters[1].opacity, '1')
      assert.ok(filters.filter((_, index) => index !== 1).every(style => style.filter === 'grayscale(1)' && style.opacity === '0.55'), 'Off-center images remain pale monochrome')

      const inactive = await rail.locator('.home-gallery-card').nth(2).boundingBox()
      if (inactive.x < width - 20) {
        await page.mouse.move(inactive.x + 12, point.y)
        await page.waitForTimeout(750)
        assert.equal(await rail.locator('img').nth(2).evaluate(image => getComputedStyle(image).filter), 'grayscale(1)', 'Hover alone cannot color an off-center image')
      }
      phase = 'keyboard'
      await rail.focus()
      await page.keyboard.press('End')
      await center(page, 3)
      await page.keyboard.press('ArrowLeft')
      await center(page, 2)
      const priorScroll = await rail.evaluate(element => element.scrollLeft)
      await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'instant' }))
      await page.waitForTimeout(250)
      assert.ok(Math.abs(await rail.evaluate(element => element.scrollLeft) - priorScroll) < 1, 'Vertical page scroll cannot advance the gallery')
      phase = 'resize'
      await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 })
      await center(page, 2)
      phase = 'resize'
      await page.setViewportSize({ width, height: 900 })
      await center(page, 2)

      phase = 'reduced motion'
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await rail.scrollIntoViewIfNeeded()
      phase = 'keyboard'
      await rail.focus()
      await page.keyboard.press('Home')
      await center(page, 0)
      assert.equal(await rail.locator('img').first().evaluate(image => getComputedStyle(image).transitionDuration), '0s')
      const reducedCard = await rail.locator('.home-gallery-card').first().boundingBox()
      await page.mouse.move(reducedCard.x + reducedCard.width / 2, reducedCard.y + 60)
      assert.deepEqual(await readFeedback(), { card: 1, image: 1, line: 1 }, 'Reduced motion keeps hover layers still')
      assert.equal(await rail.locator('.home-gallery-line').first().evaluate(element => element.getAnimations().length), 0, 'Reduced motion disables line animations')
      assert.equal(await rail.locator('.home-gallery-line[data-stretching]').count(), 0, 'Reduced motion clears the thick stroke')
      await page.keyboard.press('ArrowRight')
      await center(page, 1)
      await page.screenshot({ path: `${output}/gallery-${width}.png` })

      phase = 'directory'
      await page.locator('#selected').scrollIntoViewIfNeeded()
      assert.equal(await page.getByRole('heading', { name: 'Directory', exact: true }).count(), 1)
      const links = page.locator('.home-gallery-link')
      assert.equal(await links.count(), 4)
      for (const [index, route] of ['about', 'learning', 'projects', 'contact'].entries()) {
        assert.equal(await links.nth(index).getAttribute('href'), `/${route}/`)
      }
      assert.equal(page.url(), homeURL, 'Dragging a directory image must not follow its link')
      phase = 'drag start boundaries'
      for (const [key, index, direction] of [['Home', 0, -1], ['End', 3, 1]]) {
        await rail.focus()
        await page.keyboard.press(key)
        await center(page, index)
        await rail.scrollIntoViewIfNeeded()
        const photo = await rail.locator('.home-gallery-window').nth(index).boundingBox()
        const viewport = await rail.boundingBox()
        const edge = index === 0 ? photo.x : photo.x + photo.width
        const outer = index === 0 ? viewport.x : viewport.x + viewport.width
        const start = { x: (edge + outer) / 2, y: photo.y + 60 }
        const before = await rail.evaluate(element => element.scrollLeft)
        await drag(page, start, { x: start.x + direction * 180, y: start.y })
        assert.equal(await rail.evaluate(element => element.scrollLeft), before,
          `${key}: dragging the outer blank margin cannot move the gallery`)
        assert.equal(await rail.getAttribute('data-dragging'), null,
          `${key}: the outer blank margin cannot capture a drag`)
      }

      if (width === 1440) {
        phase = 'dragging between photos and beyond their edges'
        await rail.focus()
        await page.keyboard.press('Home')
        await center(page, 0)
        const firstPhoto = await rail.locator('.home-gallery-window').first().boundingBox()
        const secondPhoto = await rail.locator('.home-gallery-window').nth(1).boundingBox()
        const gap = { x: (firstPhoto.x + firstPhoto.width + secondPhoto.x) / 2, y: firstPhoto.y + 60 }
        await drag(page, gap, { x: gap.x - firstPhoto.width, y: gap.y })
        await center(page, 1)
        assert.equal(page.url(), homeURL, 'The gap between photos remains a valid drag starting area')

        await rail.focus()
        await page.keyboard.press('Home')
        await center(page, 0)
        const start = { x: firstPhoto.x + firstPhoto.width * .8, y: firstPhoto.y + 60 }
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await page.mouse.move(firstPhoto.x - 50, start.y, { steps: 20 })
        assert.equal(await rail.getAttribute('data-dragging'), 'true',
          'A drag started between the photo edges continues beyond its starting boundary')
        await page.mouse.move(-150, start.y, { steps: 20 })
        assert.equal(await rail.getAttribute('data-dragging'), 'true',
          'An accepted drag retains capture outside the gallery')
        await page.waitForTimeout(130)
        await page.mouse.up()
        await center(page, 2)

        phase = 'pointer cancellation and bounds'
        await rail.focus()
        await page.keyboard.press('Home')
        await center(page, 0)
        const first = await rail.locator('.home-gallery-card').first().boundingBox()
        await page.mouse.move(first.x + first.width * .7, first.y + 100)
        await page.mouse.down()
        await page.mouse.move(first.x + first.width * .3, first.y + 100, { steps: 10 })
        await rail.dispatchEvent('pointercancel')
        await page.mouse.up()
        assert.equal(await rail.getAttribute('data-dragging'), null, 'A cancelled pointer cannot leave the gallery grabbed')
        await rail.focus()
        await page.keyboard.press('End')
        await center(page, 3)
        const last = await rail.locator('.home-gallery-card').last().boundingBox()
        await drag(page, { x: last.x + last.width * .7, y: last.y + 100 }, { x: -30, y: last.y + 100 })
        await center(page, 3)
        assert.equal(await rail.getAttribute('data-dragging'), null, 'Releasing outside the rail releases pointer capture at the final image')
        assert.equal(page.url(), homeURL)

        phase = 'directory navigation'
        for (const route of ['about', 'learning', 'projects', 'contact']) {
          await page.goto(homeURL)
          const link = page.locator(`.home-gallery-link[href="/${route}/"]`)
          await link.scrollIntoViewIfNeeded()
          await link.click()
          await page.waitForURL(new URL(`${route}/`, baseURL).href)
        }
      }
      assert.deepEqual(errors, [])
      report(`PASS: ${width}px drag, hover, center color, resize, keyboard, reduced motion, and directory`)
    } catch (error) {
      throw new Error(`${width}px ${phase}: ${error.message}`)
    } finally {
      await context.close()
    }
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  try {
    await open(page)
    const cdp = await context.newCDPSession(page)
    const rail = page.locator('.home-gallery')
    const box = await rail.boundingBox()
    const y = box.y + 100
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y }] })
    for (let step = 1; step <= 15; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 320 - step * 17, y }] })
      await page.waitForTimeout(20)
    }
    await page.waitForTimeout(160)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await center(page, 1)
    await rail.focus()
    await page.keyboard.press('Home')
    await center(page, 0)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 345, y }] })
    for (let step = 1; step <= 4; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 345 - step * 76, y }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await center(page, 1)
    assert.equal(page.url(), homeURL, 'A fast touch flick cannot activate a directory link')
    const before = await page.evaluate(() => scrollY)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y }] })
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: y - step * 9 }] })
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForFunction(start => scrollY > start + 30, before)
    await center(page, 1)
    report('PASS: slow and fast touch swipes advance one photo while vertical gestures still scroll the page')
  } finally {
    await context.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.HOME_EDITORIAL_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runHomePhotoGalleryChecks(browser, process.env.HOME_EDITORIAL_TEST_URL || 'http://127.0.0.1:5173/', console.log)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
