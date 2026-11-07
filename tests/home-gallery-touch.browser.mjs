import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Native touch input exercises browser scrolling, pointer capture, and click synthesis.
export async function runHomeGalleryTouchChecks(browser, baseURL, report = () => {}) {
  const homeURL = new URL('home/', baseURL).href
  for (const [width, reducedMotion] of [[320, 'no-preference'], [390, 'no-preference'], [768, 'no-preference'], [390, 'reduce']]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion })
    await context.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-mobile', 'true'))
    const page = await context.newPage()
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const input = await context.newCDPSession(page)
    const touch = (type, points = []) => input.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map(([x, y], id) => ({ x, y, id })),
    })
    const swipe = async (from, to, { jitter = false, cancel = false, pause = 0, multiple = false, fast = false } = {}) => {
      const points = ([x, y]) => multiple ? [[x, y], [x + 40, y + 40]] : [[x, y]]
      await touch('touchStart', points(from))
      if (jitter) await touch('touchMove', [[from[0] - 2, from[1] - 7]])
      const steps = fast ? 4 : 12
      for (let step = 1; step <= steps; step++) {
        await touch('touchMove', points(from.map((value, axis) => value + (to[axis] - value) * step / steps)))
        if (!fast) await page.waitForTimeout(20)
      }
      if (pause) await page.waitForTimeout(pause)
      await touch(cancel ? 'touchCancel' : 'touchEnd')
    }
    const tap = async target => {
      await target.scrollIntoViewIfNeeded()
      const bounds = await target.boundingBox()
      await touch('touchStart', [[bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]])
      await page.waitForTimeout(80)
      await touch('touchEnd')
    }
    const pageTop = () => page.locator('#site-scroll').evaluate(element => element.scrollTop)
    let phase = 'opening'
    try {
      for (const section of ['selected', 'now']) {
        const label = `${width}px ${reducedMotion} ${section}`
        phase = `${label}: opening`
        await page.goto(homeURL)
        const rail = page.locator(`#${section} .home-gallery`)
        await rail.scrollIntoViewIfNeeded()
        await page.waitForFunction(selector => {
          const content = document.querySelector(`${selector} .home-gallery-card-content`)
          const style = getComputedStyle(content)
          return style.opacity === '1' && (style.transform === 'none' || new DOMMatrixReadOnly(style.transform).m41 < .1)
        }, `#${section}`)
        const center = index => page.waitForFunction(({ section, index }) => {
          const rail = document.querySelector(`#${section} .home-gallery`)
          const card = rail.children[index]
          const bounds = card.getBoundingClientRect()
          const container = rail.getBoundingClientRect()
          return !rail.hasAttribute('data-moving') && !rail.hasAttribute('data-dragging') &&
            card.dataset.centered === 'true' && Math.abs(bounds.left + bounds.width / 2 - container.left - container.width / 2) < 2
        }, { section, index })
        const y = (await rail.boundingBox()).y + 100
        const left = width * .2
        const right = width * .8
        const initialTop = await pageTop()
        await center(0)

        phase = `${label}: left swipe after initial finger jitter`
        await swipe([right, y], [left, y - 7], { jitter: true })
        await center(1)
        phase = `${label}: right swipe`
        await swipe([left, y], [right, y + 8])
        await center(0)
        phase = `${label}: short, slow thumb swipe`
        await swipe([right, y], [right - 52, y], { pause: 140 })
        await center(1)
        phase = `${label}: fast flick`
        await swipe([left, y], [right, y], { fast: true })
        await center(0)
        await swipe([right, y], [left, y], { fast: true })
        await center(1)
        assert.ok(Math.abs(await pageTop() - initialTop) < 2, 'Horizontal swipes preserve the page position')
        assert.equal(page.url(), homeURL, 'Swiping cannot follow a directory link')
        assert.equal(await page.locator('.home-now-reader').count(), 0, 'Swiping cannot open the notes dialog')
        report(`PASS: ${label}: left/right swipes, initial jitter, short thumb gestures, fast flicks, and click suppression`)

        phase = `${label}: vertical scrolling`
        await swipe([width / 2, y + 90], [width / 2 + 5, y - 30], { pause: 140 })
        await page.waitForFunction(top => document.getElementById('site-scroll').scrollTop > top + 30, initialTop)
        await center(1)
        await rail.scrollIntoViewIfNeeded()
        const nextY = (await rail.boundingBox()).y + 100

        phase = `${label}: cancelled gesture`
        await swipe([width / 2, nextY], [width / 2 + 20, nextY], { pause: 140, cancel: true })
        await center(1)
        phase = `${label}: multiple fingers`
        await swipe([left, nextY], [right, nextY], { multiple: true })
        await center(1)
        await swipe([left, nextY], [right, nextY])
        await center(0)
        phase = `${label}: first card boundary`
        await swipe([left, nextY], [right, nextY])
        await center(0)
        assert.equal(page.url(), homeURL)
        assert.equal(await page.locator('.home-now-reader').count(), 0)
        report(`PASS: ${label}: vertical scrolling, cancellation, multiple fingers, and first-card bounds`)

        if (width === 768) {
          phase = `${label}: last card and side gutter`
          const last = await rail.locator('.home-gallery-card').count() - 1
          await rail.focus()
          await page.keyboard.press('End')
          await center(last)
          const photo = await rail.locator('.home-gallery-window').last().boundingBox()
          const gutterX = photo.x + photo.width + 8
          assert.ok(gutterX + 60 < width, 'The test starts in the rail gutter beyond the last photo')
          await swipe([gutterX, nextY], [gutterX + 60, nextY], { pause: 140 })
          await center(last - 1)
          await swipe([right, nextY], [left, nextY])
          await center(last)
          await swipe([right, nextY], [left, nextY])
          await center(last)
          report(`PASS: ${label}: swiping from side gutters and last-card bounds`)
        }

        phase = `${label}: tap after swipe`
        // Separate the tap from Chromium's native post-gesture tap suppression.
        await page.waitForTimeout(700)
        const selected = rail.locator('.home-gallery-card[data-centered="true"] .home-gallery-link')
        if (section === 'selected') {
          const href = await selected.getAttribute('href')
          await tap(selected)
          await page.waitForURL(new URL(href, homeURL).href)
        } else {
          await tap(selected)
          await page.locator('.home-now-reader[data-phase="open"]').waitFor()
          await tap(page.locator('.home-now-close'))
          await page.locator('.home-now-reader').waitFor({ state: 'detached' })
        }
        report(`PASS: ${label}: a separate tap still opens the selected item`)
      }
      assert.deepEqual(errors, [])
    } catch (error) {
      throw new Error(`${phase}: ${error.message}`)
    } finally {
      await context.close()
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ channel: process.env.HOME_EDITORIAL_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try {
    await runHomeGalleryTouchChecks(browser, process.env.HOME_EDITORIAL_TEST_URL || 'http://127.0.0.1:5173/', console.log)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
