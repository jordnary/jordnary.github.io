import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

async function openArchive(page, baseURL) {
  await page.goto(new URL('projects/', baseURL).href)
  await page.locator('.archive-project-link').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.archive-project').evaluateAll(items => Promise.all(items.flatMap(item => item.getAnimations()).map(animation => animation.finished.catch(() => {}))))
}

async function coveredPoint(page) {
  return page.locator('.archive-project-link').first().evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const scroller = matchMedia('(pointer: coarse)').matches ? document.getElementById('site-scroll') : document.documentElement
    scroller.scrollTo({ top: scroller.scrollTop + bounds.top + 35, behavior: 'instant' })
    return { x: bounds.left + bounds.width * .8, y: 10 }
  })
}

export async function runProjectViewportChecks(browser, baseURL, report = () => {}) {
  const desktop = await browser.newContext({ viewport: { width: 2048, height: 580 }, reducedMotion: 'no-preference' })
  const page = await desktop.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await openArchive(page, baseURL)
    await page.locator('.archive-project-link').first().hover()
    await page.waitForFunction(() => document.querySelector('.archive-preview')?.dataset.state === 'visible')
    const point = await coveredPoint(page)
    await page.mouse.move(point.x, point.y)
    await page.waitForFunction(() => document.querySelector('.projects-cursor')?.dataset.mode === 'default')
    assert.ok(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('archive-header-mask'), point),
      'The painted header mask also blocks the covered links')
    await page.waitForFunction(() => document.querySelector('.archive-preview')?.dataset.state === 'hidden')
    const before = page.url()
    await page.mouse.click(point.x, point.y)
    assert.equal(page.url(), before)
    assert.equal(await page.locator('.project-page-transition').count(), 0)
    report('A covered project cannot trigger preview, plus cursor or navigation through the top background')

    await page.keyboard.press('Tab')
    await page.locator('.archive-project-link').first().focus()
    assert.ok(await page.locator('.archive-project-link').first().evaluate(element =>
      element.getBoundingClientRect().top >= document.querySelector('.archive-header').getBoundingClientRect().bottom + 20),
    'Keyboard focus brings the project below the fixed header')
    report('Keyboard navigation reveals focused projects below the header instead of leaving them obscured')

    const edge = await page.locator('.archive-project-link').nth(5).evaluate(element => {
      const bounds = element.getBoundingClientRect()
      window.scrollTo({ top: scrollY + bounds.top - innerHeight + 20, behavior: 'instant' })
      return { x: bounds.x + bounds.width / 2, y: innerHeight - 2 }
    })
    await page.mouse.move(edge.x, edge.y)
    await page.waitForFunction(() => document.querySelector('.projects-cursor')?.dataset.mode === 'preview')
    await page.waitForFunction(() => document.querySelector('.projects-cursor').getBoundingClientRect().width >= 23.9)
    for (const [x, y] of [[edge.x, edge.y], [2046, 2], [2, 2], [2, 578]]) {
      await page.mouse.move(x, y)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const bounds = await page.locator('.projects-cursor').boundingBox()
      if (bounds) assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 2048 && bounds.y + bounds.height <= 580,
        'The cursor feedback fits completely inside the viewport, including during shape changes')
    }
    report('Pointer feedback stays inside all screen edges, including a preview target at the bottom edge')
  } finally { await desktop.close() }

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    const phone = await mobile.newPage()
    phone.on('pageerror', error => errors.push(error.message))
    await openArchive(phone, baseURL)
    for (const [width, height] of [[390, 844], [430, 932], [390, 700], [844, 390], [320, 568]]) {
      await phone.setViewportSize({ width, height })
      const point = await coveredPoint(phone)
      const before = phone.url()
      assert.ok(await phone.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('.archive-project-link'), point))
      await phone.touchscreen.tap(point.x, point.y)
      assert.equal(phone.url(), before, 'A header tap cannot activate a scrolled-away project')
      const coverage = await phone.evaluate(() => {
        const bounds = document.querySelector('.archive-background').getBoundingClientRect()
        return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom,
          width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
          overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY }
      })
      assert.ok(coverage.left <= 0 && coverage.top <= 0 && coverage.right >= coverage.width && coverage.bottom >= coverage.height)
      assert.equal(coverage.overflow, false)
      assert.equal(coverage.overscroll, 'none')
    }
    await phone.setViewportSize({ width: 390, height: 844 })
    await coveredPoint(phone)
    const before = await phone.locator('#site-scroll').evaluate(element => element.scrollTop)
    const session = await mobile.newCDPSession(phone)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 382, y: 300, id: 0 }] })
    for (let step = 1; step <= 12; step++) await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: 382, y: 300 + step * 20, id: 0 }],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await phone.waitForFunction(previous => document.getElementById('site-scroll').scrollTop < previous, before)
    report('Tall phones and landscape preserve background coverage; touch scroll moves content inside the stationary frame')
    assert.deepEqual(errors, [])
  } finally { await mobile.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ channel: process.env.PROJECTS_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try {
    await runProjectViewportChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Project viewport checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
