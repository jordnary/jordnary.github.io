import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runHomeGalleryMotionChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
  })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  const homeURL = new URL('home/', baseURL).href
  const rail = page.locator('#selected .home-gallery')
  const settle = async index => {
    await page.waitForFunction(expected => {
      const element = document.querySelector('#selected .home-gallery')
      const card = element.children[expected]
      const box = card.getBoundingClientRect()
      const viewport = element.getBoundingClientRect()
      return !element.hasAttribute('data-moving') && card.dataset.centered === 'true' &&
        Math.abs(box.left + box.width / 2 - viewport.left - viewport.width / 2) < 1
    }, index)
    await page.waitForTimeout(100)
  }
  const reset = async () => {
    await rail.focus()
    await page.keyboard.press('Home')
    await settle(0)
  }
  const position = () => rail.evaluate(element => element.scrollLeft)
  try {
    await page.goto(homeURL)
    await rail.scrollIntoViewIfNeeded()
    await rail.locator('img').evaluateAll(images => Promise.all(images.map(image => {
      image.loading = 'eager'
      return image.decode()
    })))
    await settle(0)
    const box = await rail.locator('.home-gallery-card').first().boundingBox()
    const stride = await rail.evaluate(element => element.children[1].offsetLeft - element.children[0].offsetLeft)
    const start = { x: box.x + box.width * .85, y: box.y + 100 }
    const down = async () => {
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
    }
    const move = async (distance, steps = 12) => {
      await page.mouse.move(start.x - distance, start.y, { steps })
    }

    await down()
    await move(stride * .72)
    await page.waitForTimeout(160)
    const beforeRelease = await position()
    await rail.evaluate(element => {
      window.galleryReleaseTrace = []
      window.addEventListener('pointerup', () => {
        const sample = () => {
          window.galleryReleaseTrace.push({ time: performance.now(), left: element.scrollLeft })
          if (window.galleryReleaseTrace.length < 70) requestAnimationFrame(sample)
        }
        sample()
      }, { once: true })
    })
    await page.mouse.up()
    await settle(1)
    const release = await page.evaluate(() => window.galleryReleaseTrace)
    assert.ok(Math.abs(release[0].left - beforeRelease) < 3, 'Release must begin at the visible drag position without a snap jump')
    assert.ok(release.filter(sample => sample.left > beforeRelease + 3 && sample.left < stride - 3).length >= 6,
      'Settling must contain a continuous sequence of visible intermediate positions')
    for (let index = 1; index < release.length; index++) {
      const change = release[index].left - release[index - 1].left
      assert.ok(change >= -1, 'Settling must not reverse direction or jump back')
      assert.ok(change < stride * .18, 'No animation frame may teleport a large fraction of a card')
    }
    report('PASS: release continues from the dragged frame with smooth, monotonic settling')

    await reset()
    await down()
    await move(stride * 3, 5)
    await page.waitForTimeout(120)
    assert.ok(await position() > stride * 2.5, 'A long gesture must follow the pointer across multiple cards')
    await page.mouse.up()
    await settle(3)
    report('PASS: a long drag crosses multiple cards instead of stopping at the first neighbor')

    // Start on the partly visible sketch while Contact is centered, as in the
    // reported gesture. Keep the button held across both intermediate centers.
    await page.mouse.move(100, start.y)
    await page.mouse.down()
    const continuous = []
    for (let step = 1; step <= 48; step++) {
      await page.mouse.move(100 + stride * 2.05 * step / 48, start.y)
      await page.waitForTimeout(20)
      continuous.push(await position())
    }
    assert.ok(continuous.at(-1) < stride * 1.1, 'A continuous rightward drag reaches the second previous card before release')
    const middle = continuous.slice(8, -3)
    for (let index = 1; index < middle.length; index++) {
      const change = middle[index - 1] - middle[index]
      assert.ok(change > 5, 'Crossing a card center must not interrupt a continuing drag')
      assert.ok(change < stride * .15, 'Crossing a card center must not jump to the next segment')
    }
    await page.waitForTimeout(150)
    await page.mouse.up()
    await settle(1)
    assert.equal(page.url(), homeURL, 'Dragging from a neighboring card must not activate its link')
    report('PASS: holding and dragging from the sketch crosses two cards without an intermediate stop')

    await reset()
    await down()
    await move(stride * 1.3, 4)
    await page.mouse.up()
    await settle(2)
    report('PASS: a longer quick swipe can glide to the second next card')

    await reset()
    await down()
    await move(32)
    await page.waitForTimeout(160)
    await page.mouse.up()
    await settle(0)
    assert.equal(page.url(), homeURL, 'A short drag must not activate the card link')

    await down()
    await move(65, 2)
    await page.mouse.up()
    await settle(1)
    report('PASS: a small deliberate drag returns; a short quick flick advances once')

    await reset()
    await down()
    await move(stride * .65)
    await page.waitForTimeout(140)
    await page.mouse.up()
    await page.waitForTimeout(80)
    const visible = await position()
    await down()
    assert.ok(Math.abs(await position() - visible) < stride * .08, 'Grabbing a moving card must preserve its visible position')
    await move(-stride * .65)
    await page.waitForTimeout(100)
    await page.mouse.up()
    await settle(0)
    assert.equal(page.url(), homeURL, 'Reversing a running transition cannot follow a link')
    report('PASS: an unfinished transition can be grabbed and reversed continuously')

    await down()
    await move(stride * .6)
    await rail.dispatchEvent('pointercancel')
    await page.mouse.up()
    await settle(0)
    assert.equal(await rail.getAttribute('data-dragging'), null)
    await down()
    await move(stride * .7)
    await page.mouse.up()
    await settle(1)
    report('PASS: pointer cancellation returns safely and the next gesture works')

    await reset()
    await down()
    await move(stride * 2.15)
    await page.waitForTimeout(180)
    await rail.dispatchEvent('pointercancel')
    await page.mouse.up()
    await settle(2)
    report('PASS: cancelling a multi-card drag settles nearby instead of rewinding to its starting card')

    await reset()
    await page.mouse.move(start.x, start.y)
    for (let index = 0; index < 16; index++) {
      await page.mouse.wheel(120, 0)
      await page.waitForTimeout(16)
    }
    await settle(3)
    await page.waitForTimeout(250)
    assert.ok(Math.abs(await position() - stride * 3) < 2, 'Horizontal wheel distance must accumulate across multiple cards')
    for (const delta of [-180, -120, -80, -50, -35, -25, -15]) {
      await page.mouse.wheel(delta, 0)
      await page.waitForTimeout(20)
    }
    await settle(2)
    assert.ok(Math.abs(await position() - stride * 2) < 2, 'A shorter wheel gesture with a fading momentum tail settles on the neighboring card')
    const verticalBefore = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, 220)
    await page.waitForFunction(before => scrollY > before + 50, verticalBefore)
    assert.ok(Math.abs(await position() - stride * 2) < 2, 'Vertical wheel input scrolls the page without advancing the gallery')
    report('PASS: trackpad distance supports both multi-card travel and single-card settling; vertical wheel input stays native')

    await rail.scrollIntoViewIfNeeded()
    await reset()
    await down()
    await move(stride * .7)
    await page.mouse.up()
    await page.setViewportSize({ width: 390, height: 844 })
    await settle(1)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await rail.focus()
    await page.keyboard.press('ArrowRight')
    await settle(2)
    report('PASS: resize during settling preserves the destination and reduced motion still navigates')
  } finally {
    await context.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.HOME_EDITORIAL_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runHomeGalleryMotionChecks(browser, process.env.HOME_EDITORIAL_TEST_URL || 'http://127.0.0.1:5173/', console.log)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
