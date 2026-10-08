import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const dialogFor = page => page.getByRole('dialog', { name: '图片浏览器' })
const currentImage = page => page.locator('.yarl__slide_current img')
const zoomValue = page => page.getByRole('button', { name: '重置图片缩放' })
const waitZoom = (page, expected) => page.waitForFunction(value =>
  document.querySelector('.gallery-zoom-reset')?.textContent === `${value}%`, expected, { timeout: 5000 })
  .catch(async () => { throw new Error(`Expected ${expected}% zoom, received ${await zoomValue(page).textContent()}`) })
const waitImage = async (page, file) => {
  await page.waitForFunction(value => {
    const image = document.querySelector('.yarl__slide_current img')
    return image?.src.endsWith(value) && image.complete && image.naturalWidth > 0
  }, file, { timeout: 10000 }).catch(() => { throw new Error(`The gallery did not display ${file}`) })
  await page.locator('.yarl__carousel').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})))
  })
  await page.waitForFunction(() => Math.abs(
    document.querySelector('.yarl__slide_current').getBoundingClientRect().left
    - document.querySelector('.yarl__container').getBoundingClientRect().left,
  ) < 1)
}

async function touchGesture(session, from, to) {
  const points = values => values.map(([x, y], id) => ({ x, y, id, radiusX: 2, radiusY: 2 }))
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) })
  for (let step = 1; step <= 10; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(from.map(([x, y], i) => [x + (to[i][0] - x) * step / 10, y + (to[i][1] - y) * step / 10])),
    })
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

export async function runImageGalleryChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const errors = []
  const pass = name => { checks.push(name); report(name) }
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(url('projects/vae-gan-digits/'))
    const cover = page.locator('.project-reader-cover .gallery-trigger')
    await page.locator('.project-reader-cover img').click()
    assert.equal(await dialogFor(page).count(), 0)
    await cover.click()
    const dialog = dialogFor(page)
    await dialog.waitFor()
    await waitImage(page, '/vaegan-poster.webp')
    const thumbnails = dialog.getByRole('navigation', { name: '图片缩略图' })
    assert.equal(await thumbnails.getByRole('button').count(), 7)
    await thumbnails.getByRole('button', { name: '第 2 张，共 7 张' }).click()
    await waitImage(page, '/vaegan-comparison.webp')
    assert.equal(await thumbnails.getByRole('button', { name: '第 2 张，共 7 张' }).getAttribute('aria-current'), 'true')
    pass('Only the explicit expand button opens the viewer; unique thumbnails select the correct full-size image')

    const previous = dialog.getByRole('button', { name: '上一张图片' })
    await page.mouse.move(720, 400)
    const idleIconBackground = await previous.locator('svg').evaluate(element => getComputedStyle(element).backgroundColor)
    const arrowBounds = await previous.boundingBox()
    assert.equal(arrowBounds.width, 44)
    assert.equal(arrowBounds.height, 44)
    assert.ok(await previous.evaluate(element => {
      const box = element.getBoundingClientRect()
      return !document.elementFromPoint(box.x + box.width / 2, box.y - 60)?.closest('.yarl__navigation_prev')
    }))
    await previous.hover()
    assert.equal(await previous.evaluate(element => getComputedStyle(element).opacity), '1')
    assert.equal(await previous.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)')
    const highlightedIconBackground = await previous.locator('svg').evaluate(element => getComputedStyle(element).backgroundColor)
    assert.notEqual(highlightedIconBackground, idleIconBackground)
    await previous.click()
    await waitImage(page, '/vaegan-poster.webp')
    await page.keyboard.press('ArrowRight')
    await waitImage(page, '/vaegan-comparison.webp')
    pass('Desktop navigation uses compact arrow buttons and highlights only the icon; keyboard arrows still select images')

    const next = dialog.getByRole('button', { name: '下一张图片' })
    for (const [button, key, image] of [
      [next, 'ArrowRight', '/vaegan-reconstructions.webp'],
      [previous, 'ArrowLeft', '/vaegan-comparison.webp'],
    ]) {
      await button.click()
      await waitImage(page, '/vaegan-training.webp')
      await page.mouse.move(720, 400)
      await page.keyboard.press(key)
      await waitImage(page, image)
      assert.ok(await page.locator('.yarl__container').evaluate(element => element === document.activeElement), 'Arrow shortcuts return focus to the image stage')
      assert.equal(await button.locator('svg').evaluate(element => getComputedStyle(element).backgroundColor), idleIconBackground)
      assert.equal(await button.evaluate(element => element.matches(':focus-visible')), false)
    }
    for (let index = 0; index < 15 && !await previous.evaluate(element => element === document.activeElement); index++) {
      await page.keyboard.press('Tab')
    }
    assert.ok(await previous.evaluate(element => element.matches(':focus-visible')))
    assert.equal(await previous.evaluate(element => getComputedStyle(element).outlineStyle), 'none')
    assert.equal(await previous.locator('svg').evaluate(element => getComputedStyle(element).backgroundColor), highlightedIconBackground)
    await page.keyboard.press('Enter')
    await waitImage(page, '/vaegan-poster.webp')
    await page.keyboard.press('ArrowRight')
    await waitImage(page, '/vaegan-comparison.webp')
    pass('Arrow shortcuts clear stale button highlights; Tab focus matches hover and Enter still activates navigation')

    await page.mouse.move(900, 400)
    await page.mouse.down()
    await page.mouse.move(350, 400, { steps: 10 })
    await page.mouse.up()
    for (let index = 0; index < 5; index++) await page.mouse.wheel(180, 0)
    await page.waitForTimeout(400)
    await waitImage(page, '/vaegan-comparison.webp')
    await waitZoom(page, 100)
    pass('Desktop mouse drags and horizontal trackpad gestures do not switch images')

    await dialog.getByRole('button', { name: '放大图片', exact: true }).click()
    await waitZoom(page, 150)
    const wrapper = page.locator('.yarl__slide_current .yarl__slide_wrapper')
    const initialTransform = await wrapper.evaluate(element => getComputedStyle(element).transform)
    const stage = await page.locator('.yarl__container').boundingBox()
    const center = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 }
    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await page.mouse.move(center.x + 140, center.y + 55, { steps: 10 })
    await page.mouse.up()
    assert.notEqual(await wrapper.evaluate(element => getComputedStyle(element).transform), initialTransform)
    await waitImage(page, '/vaegan-comparison.webp')
    await zoomValue(page).click()
    await waitZoom(page, 100)
    await page.mouse.move(center.x, center.y)
    await page.mouse.wheel(0, -180)
    await page.waitForFunction(() => parseInt(document.querySelector('.gallery-zoom-reset').textContent) > 100)
    await zoomValue(page).click()
    await waitZoom(page, 100)
    await currentImage(page).dblclick()
    await page.waitForFunction(() => parseInt(document.querySelector('.gallery-zoom-reset').textContent) > 100)
    await thumbnails.getByRole('button', { name: '第 7 张，共 7 张' }).click()
    await waitImage(page, '/vaegan-samples.webp')
    await thumbnails.getByRole('button', { name: '第 1 张，共 7 张' }).click()
    await waitImage(page, '/vaegan-poster.webp')
    await waitZoom(page, 100)
    pass('Button, wheel and double-click zoom work; dragging pans without changing slides and switching images resets zoom')

    const originalHeight = (await page.locator('.yarl__container').boundingBox()).height
    await dialog.getByRole('button', { name: '隐藏缩略图' }).click()
    await thumbnails.waitFor({ state: 'hidden' })
    assert.ok((await page.locator('.yarl__container').boundingBox()).height > originalHeight)
    await dialog.getByRole('button', { name: '显示缩略图' }).click()
    await thumbnails.waitFor()
    await dialog.getByRole('button', { name: '进入全屏' }).click()
    await page.waitForFunction(() => Boolean(document.fullscreenElement))
    await dialog.getByRole('button', { name: '退出全屏' }).click()
    await page.waitForFunction(() => !document.fullscreenElement)
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let index = 0; index < 15; index++) {
        await page.keyboard.press(key)
        assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), `${key} ${index}: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 180))}`)
      }
    }
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.ok(await cover.evaluate(element => element === document.activeElement))
    assert.ok(await page.evaluate(() => !document.getElementById('root').inert && !document.body.classList.contains('yarl__no_scroll')))
    pass('Thumbnails toggle, native fullscreen, two-way focus containment, Escape, scroll unlock and opener focus restoration work')

    const resultFigure = page.locator('.project-introduction-figure').filter({ has: page.locator('img[src$="/vaegan-comparison.webp"]') })
    const figure = resultFigure.locator('.gallery-trigger')
    await resultFigure.locator('img').click()
    assert.equal(await dialog.count(), 0)
    await figure.click()
    await waitImage(page, '/vaegan-comparison.webp')
    for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
      await page.setViewportSize(size)
      await page.waitForFunction(() => [...document.querySelectorAll('.yarl__toolbar button')].every(element => {
        const box = element.getBoundingClientRect()
        return box.x >= 0 && box.right <= innerWidth + 1 && box.y >= 0 && box.bottom <= innerHeight
      }))
      const bounds = await page.locator('.yarl__container').boundingBox()
      assert.ok(bounds.height > 100 && bounds.width <= size.width)
      assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${size.width}px viewer overflow`)
    }
    await dialog.getByRole('button', { name: '关闭图片预览' }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.ok(await figure.evaluate(element => element === document.activeElement))
    pass('Inline figures open the original result, and all controls fit phone, tablet, desktop and landscape layouts')

    await page.goto(url('projects/briefing-atlas/'))
    await page.locator('.project-reader-cover .gallery-trigger').click()
    await dialog.waitFor()
    assert.equal(await dialog.getByRole('button', { name: /上一张图片|下一张图片|隐藏缩略图/ }).count(), 0)
    assert.equal(await dialog.getByRole('navigation', { name: '图片缩略图' }).count(), 0)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    pass('Single-image galleries omit unnecessary navigation and thumbnail controls')

    if (process.env.PROJECTS_CAPTURE === '1') {
      await mkdir('node_modules/.cache/gallery-preview', { recursive: true })
      await page.goto(url('projects/vae-gan-digits/'))
      await page.locator('.project-reader-cover .gallery-trigger').click()
      await waitImage(page, '/vaegan-poster.webp')
      await page.screenshot({ path: 'node_modules/.cache/gallery-preview/desktop.png' })
    }
  } finally { await context.close() }

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  try {
    const touchPage = await touchContext.newPage()
    touchPage.on('pageerror', error => errors.push(error.message))
    const session = await touchContext.newCDPSession(touchPage)
    await touchPage.goto(url('projects/vae-gan-digits/'))
    await touchPage.locator('.project-reader-cover .gallery-trigger').tap()
    await waitImage(touchPage, '/vaegan-poster.webp')
    await touchGesture(session, [[325, 400]], [[65, 400]])
    await waitImage(touchPage, '/vaegan-comparison.webp')
    await touchGesture(session, [[65, 400]], [[325, 400]])
    await waitImage(touchPage, '/vaegan-poster.webp')
    pass('Mobile touch swipes select the next and previous images')
    const stage = await touchPage.locator('.yarl__container').boundingBox()
    const edgeY = stage.y + 70
    await touchPage.touchscreen.tap(380, edgeY)
    await waitImage(touchPage, '/vaegan-comparison.webp')
    await touchPage.touchscreen.tap(10, edgeY)
    await waitImage(touchPage, '/vaegan-poster.webp')
    await touchGesture(session, [[380, 400]], [[65, 400]])
    await waitImage(touchPage, '/vaegan-comparison.webp')
    await touchGesture(session, [[10, 400]], [[325, 400]])
    await waitImage(touchPage, '/vaegan-poster.webp')
    pass('Mobile edge taps switch images, and swipes starting at either edge remain available')
    await touchGesture(session, [[155, 400], [235, 400]], [[85, 400], [305, 400]])
    await touchPage.waitForFunction(() => parseInt(document.querySelector('.gallery-zoom-reset').textContent) > 100, null, { timeout: 10000 })
    pass('Mobile two-finger gestures zoom the image')
    const wrapper = touchPage.locator('.yarl__slide_current .yarl__slide_wrapper')
    const before = await wrapper.evaluate(element => element.style.transform)
    // Separate independent gestures from the browser and viewer double-tap window.
    await touchPage.waitForTimeout(350)
    await touchGesture(session, [[195, 400]], [[275, 435]])
    assert.notEqual(await wrapper.evaluate(element => element.style.transform), before)
    await waitImage(touchPage, '/vaegan-poster.webp')
    pass('Mobile panning preserves the selected image')
    await touchPage.waitForTimeout(350)
    assert.equal(await zoomValue(touchPage).isDisabled(), false)
    await zoomValue(touchPage).tap()
    await waitZoom(touchPage, 100)
    await touchPage.getByRole('button', { name: '隐藏缩略图' }).tap()
    await touchPage.getByRole('navigation', { name: '图片缩略图' }).waitFor({ state: 'hidden' })
    await touchPage.getByRole('button', { name: '显示缩略图' }).tap()
    await touchPage.getByRole('navigation', { name: '图片缩略图' }).waitFor()
    await touchPage.getByRole('button', { name: '进入全屏' }).tap()
    await touchPage.waitForFunction(() => Boolean(document.fullscreenElement))
    await touchPage.getByRole('button', { name: '退出全屏' }).tap()
    await touchPage.waitForFunction(() => !document.fullscreenElement)
    assert.equal(await touchPage.getByRole('button', { name: '下一张图片' }).evaluate(element => getComputedStyle(element).opacity), '1')
    if (process.env.PROJECTS_CAPTURE === '1') {
      await touchPage.screenshot({ path: 'node_modules/.cache/gallery-preview/mobile.png' })
    }
    await touchPage.getByRole('button', { name: '关闭图片预览' }).tap()
    await dialogFor(touchPage).waitFor({ state: 'hidden' })
    pass('Mobile touch events support left/right swipes, two-finger zoom and panning without accidental image changes')
  } finally { await touchContext.close() }

  const brokenContext = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    await brokenContext.route('**/images/projects/vaegan-comparison.webp', route => route.abort())
    const brokenPage = await brokenContext.newPage()
    brokenPage.on('pageerror', error => errors.push(error.message))
    await brokenPage.goto(url('projects/vae-gan-digits/'))
    await brokenPage.locator('.project-introduction-figure').filter({ has: brokenPage.locator('img[src$="/vaegan-comparison.webp"]') }).locator('.gallery-trigger').click()
    const dialog = dialogFor(brokenPage)
    await dialog.locator('.yarl__slide_current').getByText('图片暂时未能加载', { exact: true }).waitFor()
    await dialog.getByRole('button', { name: '上一张图片' }).click()
    await waitImage(brokenPage, '/vaegan-poster.webp')
    await dialog.getByRole('button', { name: '关闭图片预览' }).click()
    await dialog.waitFor({ state: 'hidden' })
    pass('Failed images show a readable fallback while navigation and closing remain available')
  } finally { await brokenContext.close() }
  assert.deepEqual(errors, [])
  pass('No uncaught browser errors during gallery interactions')
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runImageGalleryChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} image gallery checks passed`)
  } catch (error) {
    console.error('Image gallery checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
