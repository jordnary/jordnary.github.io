import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const galleryURL = baseURL => new URL('projects/vae-gan-digits/', baseURL).href
const waitImage = async (page, file, aligned = true) => {
  await page.waitForFunction(value => {
    const image = document.querySelector('.yarl__slide_current img')
    return image?.src.endsWith(value) && image.complete && image.naturalWidth > 0
  }, file)
  await page.locator('.yarl__carousel').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})))
  })
  if (aligned) await page.waitForFunction(() => Math.abs(document.querySelector('.yarl__slide_current').getBoundingClientRect().left
    - document.querySelector('.yarl__container').getBoundingClientRect().left) < 1)
}

async function selectImage(page, session, target) {
  const label = await page.locator('.yarl__thumbnails_thumbnail[aria-current="true"]').getAttribute('aria-label')
  let current = Number(label.match(/\d+/)[0]) - 1
  const step = Math.sign(target - current)
  while (current !== target) {
    const stage = await page.locator('.yarl__container').boundingBox()
    const left = stage.x + stage.width * .22
    const right = stage.x + stage.width * .78
    const y = stage.y + stage.height / 2
    await drag(session, [step > 0 ? right : left, y], [step > 0 ? left : right, y])
    current += step
    await page.waitForFunction(index => document.querySelector('.yarl__thumbnails_thumbnail[aria-current="true"]')
      ?.getAttribute('aria-label') === `第 ${index + 1} 张，共 7 张`, current)
    await page.locator('.yarl__carousel').evaluate(async element => {
      await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})))
    })
  }
}
const opacity = (page, selector, value) => page.waitForFunction(({ selector, value }) =>
  Number(getComputedStyle(document.querySelector(selector)).opacity) === value, { selector, value })

async function probeOpacity(page, selector, action, finalOpacity) {
  await page.evaluate(selector => {
    const target = document.querySelector(selector)
    const probe = window.galleryOpacityProbe = { values: [], bounds: [], frame: 0 }
    const sample = () => {
      probe.values.push(Number(getComputedStyle(target).opacity))
      const { x, y, width, height } = (target.querySelector('.gallery-icon') ?? target).getBoundingClientRect()
      probe.bounds.push({ x, y, width, height })
      probe.frame = requestAnimationFrame(sample)
    }
    sample()
  }, selector)
  await action()
  await opacity(page, selector, finalOpacity)
  return page.evaluate(() => {
    cancelAnimationFrame(window.galleryOpacityProbe.frame)
    const { values, bounds } = window.galleryOpacityProbe
    return { values, bounds }
  })
}

async function drag(session, from, to, release = true) {
  const point = ([x, y]) => [{ x, y, id: 0, radiusX: 2, radiusY: 2 }]
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) })
  for (let step = 1; step <= 10; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point([
      from[0] + (to[0] - from[0]) * step / 10, from[1] + (to[1] - from[1]) * step / 10,
    ]) })
  }
  if (release) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

export async function runGalleryNavigationChecks(browser, baseURL, report = () => {}) {
  const errors = []
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  try {
    const page = await desktop.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(galleryURL(baseURL))
    await page.locator('.project-reader-cover .project-reader-image-trigger').click()
    await waitImage(page, '/vaegan-poster.webp')
    const stage = await page.locator('.yarl__container').boundingBox()
    const next = page.getByRole('button', { name: '下一张图片' })
    const center = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 }
    await page.mouse.move(center.x, center.y)
    await opacity(page, '.yarl__navigation_next', 0)
    const button = await next.boundingBox()
    const nearby = { x: button.x - 60, y: button.y + 55 }
    assert.ok(await page.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('button'), nearby), 'Proximity does not require hovering the button itself')
    const entrance = await probeOpacity(page, '.yarl__navigation_next', () => page.mouse.move(nearby.x, nearby.y), 1)
    assert.ok(entrance.values.some(value => value > 0 && value < 1), 'The nearby arrow visibly fades in')
    const exit = await probeOpacity(page, '.yarl__navigation_next', () => page.mouse.move(center.x, center.y), 0)
    assert.ok(exit.values.some(value => value > 0 && value < 1), 'The arrow visibly fades out after leaving')
    for (const probe of [entrance, exit]) {
      for (const bounds of probe.bounds) assert.deepEqual(bounds, probe.bounds[0], 'The arrow stays in place and keeps its size throughout the fade')
    }
    assert.equal(await next.evaluate(element => element.getBoundingClientRect().width), 44)
    report('Desktop arrows fade in and out in place without moving or scaling')

    await next.click()
    await waitImage(page, '/vaegan-comparison.webp')
    await page.mouse.move(center.x, center.y)
    await page.locator('.yarl__container').focus()
    for (let step = 0; step < 20 && !await next.evaluate(element => element === document.activeElement); step++) await page.keyboard.press('Tab')
    assert.ok(await next.evaluate(element => element.matches(':focus-visible')))
    await opacity(page, '.yarl__navigation_next', 1)
    await page.keyboard.press('Enter')
    await waitImage(page, '/vaegan-training.webp')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await next.evaluate(element => getComputedStyle(element).transitionDuration), '0s')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: '图片浏览器' }).waitFor({ state: 'detached' })
    report('Keyboard focus reveals the arrow, Enter switches images, and reduced motion removes the fade')
  } finally { await desktop.close() }

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'no-preference' })
  try {
    const page = await mobile.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(galleryURL(baseURL))
    await page.locator('.project-reader-cover .project-reader-image-trigger').tap()
    await waitImage(page, '/vaegan-poster.webp')
    // The following drag is independent of the opening tap and its double-tap window.
    await page.waitForTimeout(350)
    const session = await mobile.newCDPSession(page)
    assert.equal(await page.getByRole('button', { name: /上一张图片|下一张图片/ }).count(), 0, 'Touch navigation renders no arrow buttons')
    const left = '.gallery-edge-glow[data-side="left"]'
    const right = '.gallery-edge-glow[data-side="right"]'
    const release = () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const capture = async name => {
      if (process.env.PROJECTS_CAPTURE !== '1') return
      await mkdir('node_modules/.cache/gallery-preview', { recursive: true })
      await page.screenshot({ path: `node_modules/.cache/gallery-preview/${name}.png` })
    }

    await drag(session, [100, 400], [310, 400], false)
    await page.waitForFunction(selector => Number(getComputedStyle(document.querySelector(selector)).opacity) > 0.6, left)
    await opacity(page, right, 0)
    await waitImage(page, '/vaegan-poster.webp', false)
    await capture('mobile-first-edge-theme')
    const fading = await probeOpacity(page, left, release, 0)
    assert.ok(fading.values.some(value => value > 0.05 && value < 0.6), 'The edge glow gently fades after release')
    report('Dragging beyond the first image shows only a left edge glow that fades on release without changing images')

    await selectImage(page, session, 6)
    await waitImage(page, '/vaegan-samples.webp')
    await drag(session, [300, 400], [80, 400], false)
    await page.waitForFunction(selector => Number(getComputedStyle(document.querySelector(selector)).opacity) > 0.6, right)
    await opacity(page, left, 0)
    await waitImage(page, '/vaegan-samples.webp', false)
    await capture('mobile-last-edge-theme')
    await release()
    await opacity(page, right, 0)
    report('Dragging beyond the last image shows only a right edge glow and retains the selected image')

    await selectImage(page, session, 0)
    await waitImage(page, '/vaegan-poster.webp')
    await drag(session, [300, 400], [80, 400])
    await waitImage(page, '/vaegan-comparison.webp')
    assert.equal(await page.locator('.gallery-edge-glow[data-active="true"]').count(), 0)
    await selectImage(page, session, 0)
    await waitImage(page, '/vaegan-poster.webp')
    await drag(session, [195, 300], [195, 500])
    assert.equal(await page.locator('.gallery-edge-glow[data-active="true"]').count(), 0)
    await page.getByRole('button', { name: '放大图片', exact: true }).tap()
    await page.waitForFunction(() => document.querySelector('.gallery-zoom-reset').textContent === '150%')
    await drag(session, [100, 400], [280, 400], false)
    assert.equal(await page.locator('.gallery-edge-glow[data-active="true"]').count(), 0)
    await release()
    report('Normal image swipes, vertical gestures, and panning a zoomed image never trigger boundary feedback')

    await page.getByRole('button', { name: '重置图片缩放' }).tap()
    await page.waitForFunction(() => document.querySelector('.gallery-zoom-reset').textContent === '100%')
    await drag(session, [100, 400], [220, 400], false)
    await page.waitForFunction(selector => Number(getComputedStyle(document.querySelector(selector)).opacity) > 0.3, left)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: 220, y: 400, id: 0 }, { x: 280, y: 400, id: 1 },
    ] })
    assert.equal(await page.locator('.gallery-edge-glow[data-active="true"]').count(), 0)
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await opacity(page, left, 0)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await drag(session, [100, 400], [280, 400], false)
    assert.ok(await page.locator(left).evaluate(element => Number(getComputedStyle(element).opacity) > 0.3))
    await release()
    await opacity(page, left, 0)
    report('Adding a second finger or canceling a touch clears the glow; reduced motion keeps a static boundary hint')
    await page.getByRole('button', { name: '关闭图片预览' }).tap()
    await page.getByRole('dialog', { name: '图片浏览器' }).waitFor({ state: 'detached' })
  } finally { await mobile.close() }
  assert.deepEqual(errors, [], 'Navigation feedback produces no browser errors')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try {
    await runGalleryNavigationChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Gallery navigation checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
