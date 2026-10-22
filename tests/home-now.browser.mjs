import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const snapshot = {
  fetchedAt: '2026-10-20T01:00:00Z', profile: { followers: 2, publicRepos: 3 },
  repos: Array.from({ length: 3 }, (_, i) => ({ name: `small-project-${i + 1}`, description: '持续维护的小项目。 Small improvements, one step at a time.', language: 'TypeScript', stars: i, updatedAt: '2026-10-19T02:00:00Z', url: `https://github.com/example/project-${i + 1}` })),
}
const feed = {
  generatedAt: '2026-10-20T01:00:00Z',
  items: Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: `好奇心与日常探索 ${i + 1} / A longer English reading title that wraps naturally`, description: '记录新的视角与思考。 Notes on small discoveries and thoughtful experiments.', source: 'Example Journal', sourceUrl: 'https://example.com', publishedAt: '2026-10-19T02:00:00Z', url: `https://example.com/article-${i + 1}` })),
}

async function waitForReader(page) {
  const reader = page.locator('.home-now-reader')
  await reader.locator('.home-now-reader-scroll').waitFor()
  await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open')
  return reader
}

function assertBoundsNear(actual, expected, message, tolerance = 3) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(actual[key] - expected[key]) <= tolerance,
      `${message}: ${key} differs by ${Math.abs(actual[key] - expected[key]).toFixed(2)}px`)
  }
}

async function assertReaderScroll(reader, page) {
  const before = await page.evaluate(() => scrollY)
  const metrics = await reader.locator('.home-now-reader-scroll').evaluate(element => {
    const style = getComputedStyle(element)
    const webkit = getComputedStyle(element, '::-webkit-scrollbar')
    element.scrollTop = element.scrollHeight
    return {
      scrollbarHidden: style.scrollbarWidth === 'none' || webkit.display === 'none',
      canScroll: element.scrollHeight <= element.clientHeight || element.scrollTop > 0,
      fits: element.scrollWidth <= element.clientWidth + 1,
    }
  })
  assert.ok(metrics.scrollbarHidden, 'The reading scrollbar is visually hidden')
  assert.ok(metrics.canScroll, 'The reading surface remains scrollable without a scrollbar')
  assert.ok(metrics.fits, 'The reading surface has no horizontal overflow')
  assert.equal(await page.evaluate(() => scrollY), before, 'Reading does not move the background page')
  await reader.locator('.home-now-reader-scroll').evaluate(element => { element.scrollTop = 0 })
}

async function assertReaderTypography(reader, page) {
  await page.evaluate(() => document.fonts.ready)
  const typography = await reader.evaluate(element => {
    const description = getComputedStyle(element.querySelector('.home-now-reader-description'))
    const heading = getComputedStyle(element.querySelector('.home-now-reader-english'))
    return {
      bodySize: parseFloat(description.fontSize),
      bodyFamily: description.fontFamily,
      displayFamily: heading.fontFamily,
      detailSizes: Array.from(element.querySelectorAll('.github-repository-main > span, .rss-item-copy > span'))
        .map(copy => parseFloat(getComputedStyle(copy).fontSize)),
      loadedFamilies: Array.from(document.fonts).filter(face => face.status === 'loaded').map(face => face.family),
      chineseReady: document.fonts.check('18px "Woodland WenKai"', '林间手记'),
      englishReady: document.fonts.check('48px "Woodland Display"', 'What I am building'),
    }
  })
  assert.ok(typography.bodySize >= 17 && typography.detailSizes.every(size => size >= 17), 'Reading text remains at least 17px')
  assert.match(typography.bodyFamily, /Woodland WenKai/, 'The intended Chinese reading face is applied')
  assert.match(typography.displayFamily, /Woodland Display/, 'The intended English display face is applied')
  assert.ok(typography.chineseReady && typography.englishReady &&
    ['Woodland WenKai', 'Woodland Display'].every(name => typography.loadedFamilies.some(family => family.includes(name))),
  'Both local web fonts finish loading successfully')
}

export async function runHomeNowChecks(browser, baseURL, report = () => {}) {
  const output = 'node_modules/.cache/home-now'
  await mkdir(output, { recursive: true })
  for (const width of [320, 390, 768, 1440, 2558]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: 'no-preference', hasTouch: width < 600, isMobile: width < 600 })
    await context.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    let githubMode = 'ready'
    let feedMode = 'ready'
    await page.route('**/data/github.json', route => route.fulfill({ status: githubMode === 'error' ? 503 : 200, json: snapshot }))
    await page.route('**/data/rss.json', route => route.fulfill({ status: feedMode === 'error' ? 503 : 200, json: feedMode === 'empty' ? { ...feed, items: [] } : feedMode === 'invalid' ? {} : feed }))
    try {
      await page.goto(new URL('home/', baseURL).href)
      await page.evaluate(() => document.fonts.ready)
      const section = page.locator('#now')
      const rail = section.locator('.home-gallery')
      const cards = rail.locator('.home-gallery-open')
      assert.equal(await page.getByRole('heading', { name: 'The journal', exact: true }).count(), 0)
      assert.equal(await page.locator('#journal, #live, .home-editorial-live').count(), 0)
      assert.equal(await page.getByRole('heading', { name: 'Now & notes', exact: true }).count(), 1)
      assert.equal(await page.locator('#selected .home-gallery-card').count(), 4)
      assert.equal(await cards.count(), 2)
      assert.equal(await section.getByText('Explore', { exact: true }).count(), 0, 'The covers have no extra Explore badge')
      assert.ok((await cards.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label') || '')))
        .every(label => label.length > 0 && !/explore/i.test(label)), 'Cover buttons have meaningful labels without Explore')
      assert.equal(await section.locator('img').count(), 2, 'Both Now & notes covers are present')
      assert.deepEqual(await section.locator('.home-gallery-caption').allTextContents(), ['What I’m building我最近在维护', 'What I’m following我最近在关注'])
      await rail.scrollIntoViewIfNeeded()
      await section.locator('img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode() })))
      assert.ok(await section.locator('img').evaluateAll(images => images.every(image =>
        image.complete && image.naturalWidth === 1536 && image.naturalHeight === 1024 && image.alt.trim().length > 0)),
      'Both covers load at their original dimensions with descriptive alternative text')
      await page.waitForFunction(() => document.querySelector('#now [data-home-reveal="gallery"]').classList.contains('is-revealed'))
      await page.waitForTimeout(1800)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The page fits the viewport')
      await page.screenshot({ path: `${output}/cards-${width}.png` })
      const initialURL = page.url()
      const backgroundWidth = await page.evaluate(() => document.body.clientWidth)
      await cards.first().click()
      const reader = page.locator('.home-now-reader')
      await reader.waitFor()
      await reader.locator('.github-repository').first().waitFor()
      assert.equal(await reader.locator('.github-repository').count(), 3)
      assert.equal(await reader.locator('.rss-item').count(), 0)
      assert.equal(page.url(), initialURL, 'Explore keeps the current home page')
      assert.equal(await page.locator('dialog:modal').count(), 1)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'The page keeps its existing scrollbar and viewport geometry')
      await waitForReader(page)
      await assertReaderTypography(reader, page)
      assert.equal(await page.evaluate(() => document.body.clientWidth), backgroundWidth, 'Opening preserves the background page width')
      const bounds = await reader.boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
      assert.ok(Math.abs(bounds.width / bounds.height - 1.5) < .002, 'The reader stays landscape even on portrait phones')
      assert.ok(await reader.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Chinese and English fit within the floating page')
      const scrollBefore = await page.evaluate(() => scrollY)
      const originalHeight = await page.evaluate(() => document.documentElement.scrollHeight)
      await assertReaderScroll(reader, page)
      await reader.locator('.home-now-reader-scroll').evaluate(element => { element.scrollTop = element.scrollHeight })
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, 'Only the floating page scrolls')
      await page.keyboard.press('Shift+Tab')
      assert.ok(await reader.evaluate(element => element.contains(document.activeElement)), 'Native dialog traps keyboard focus')
      await reader.locator('.home-now-reader-scroll').evaluate(element => { element.scrollTop = 0 })
      await page.screenshot({ path: `${output}/code-${width}.png` })
      githubMode = 'error'
      await reader.getByRole('button', { name: '刷新动态 / Refresh', exact: true }).click()
      await reader.getByText('暂时无法更新，显示上次成功的数据。', { exact: false }).waitFor()
      assert.equal(await reader.locator('.github-repository').count(), 3, 'A failed refresh preserves the cached projects')
      await page.keyboard.press('Escape')
      await reader.waitFor({ state: 'detached' })
      assert.equal(await cards.first().evaluate(element => document.activeElement === element), true)
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, 'Closing preserves the background scroll position')
      assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), originalHeight, 'Closing preserves the background document height')
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await rail.focus()
      await page.keyboard.press('End')
      await page.waitForFunction(() => document.querySelector('#now .home-gallery-card:last-child').dataset.centered === 'true' && !document.querySelector('#now .home-gallery').hasAttribute('data-moving'))
      await cards.last().click()
      await reader.locator('.rss-item').first().waitFor()
      await waitForReader(page)
      await assertReaderTypography(reader, page)
      assert.equal(await reader.locator('.github-repository').count(), 0)
      assert.equal(await reader.locator('.rss-item').count(), 4)
      assert.ok(await reader.locator('.rss-item').first().evaluate(element => {
        const title = element.querySelector('strong')
        const source = element.querySelector('.rss-item-source').getBoundingClientRect()
        const copy = element.querySelector('.rss-item-copy').getBoundingClientRect()
        return getComputedStyle(title).whiteSpace === 'normal' && copy.top >= source.bottom && copy.width > element.getBoundingClientRect().width * .9
      }), 'Long bilingual article titles wrap across the full reading width')
      const scene = reader.locator('.home-now-reader-scene')
      assert.equal(await scene.count(), 1, 'The woodland artwork is present')
      await scene.evaluate(element => Promise.all(Array.from(element.matches('img') ? [element] : element.querySelectorAll('img'))
        .map(image => image.decode())))
      assert.ok(await scene.locator('img').evaluate(image => image.naturalWidth / image.naturalHeight === 1.5),
        'Every screen uses the complete landscape artwork')
      await page.screenshot({ path: `${output}/reading-${width}.png` })
      for (const mode of ['error', 'invalid', 'empty', 'ready']) {
        feedMode = mode
        await reader.getByRole('button', { name: '刷新动态 / Refresh', exact: true }).click()
        await reader.locator('.home-now-live-content[aria-busy="false"]').waitFor()
        if (['error', 'invalid'].includes(mode)) {
          await reader.getByText('暂时无法更新，显示上次成功的数据。', { exact: false }).waitFor()
          assert.equal(await reader.locator('.rss-item').count(), 4)
        } else if (mode === 'empty') {
          await reader.getByText('还没有收录的文章。', { exact: false }).waitFor()
          assert.equal(await reader.locator('.live-state-error').count(), 0, 'An empty feed is not a fetch failure')
        } else assert.equal(await reader.locator('.rss-item').count(), 4, 'Refresh recovers successfully')
      }
      await reader.getByRole('button', { name: '关闭近况 / Close', exact: true }).click()
      await reader.waitFor({ state: 'detached' })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await cards.last().click()
      await waitForReader(page)
      assert.equal(await reader.evaluate(element => getComputedStyle(element).animationName), 'none')
      assert.equal(await reader.evaluate(element => element.getAnimations().filter(animation =>
        !animation.effect?.pseudoElement && animation.effect?.getKeyframes().some(frame => frame.transform)).length), 0, 'Reduced motion skips the panel morph')
      await page.mouse.click(2, 2)
      await reader.waitFor({ state: 'detached' })
      assert.equal(await cards.last().evaluate(element => document.activeElement === element), true)
      if (width === 1440) {
        // A real drag on the button must move the gallery without opening a page.
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        const cover = await cards.last().locator('.home-gallery-window').boundingBox()
        await page.mouse.move(cover.x + 40, cover.y + cover.height / 2)
        await page.mouse.down()
        await page.mouse.move(cover.x + cover.width * .8, cover.y + cover.height / 2, { steps: 24 })
        await page.waitForTimeout(130)
        await page.mouse.up()
        await page.waitForFunction(() => document.querySelector('#now .home-gallery-card').dataset.centered === 'true')
        assert.equal(await reader.count(), 0, 'Dragging suppresses Explore clicks')
      }
      assert.deepEqual(errors, [])
      report(`PASS: ${width}px artwork covers, bilingual layout, floating pages, focus, refresh, cache and reduced motion`)
    } finally { await context.close() }
  }
}

export async function runHomeNowFailureChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  let release
  const pending = new Promise(resolve => { release = resolve })
  let failed = true
  let malformed = true
  await page.route('**/data/github.json', async route => { await pending; await route.fulfill({ status: failed ? 503 : 200, json: snapshot }) })
  await page.route('**/data/rss.json', route => route.fulfill({ json: malformed ? {} : { ...feed, items: [] } }))
  try {
    await page.goto(new URL('home/', baseURL).href)
    await page.locator('#now .home-gallery-open').first().click()
    const reader = page.locator('.home-now-reader')
    await reader.getByText('正在获取 GitHub…', { exact: false }).waitFor()
    assert.equal(await reader.locator('.live-refresh-button').isDisabled(), true)
    release()
    await reader.locator('.live-state-error').waitFor()
    assert.equal(await reader.locator('.live-refresh-button').isEnabled(), true)
    failed = false
    await reader.locator('.live-refresh-button').click()
    await reader.locator('.github-repository').first().waitFor()
    await page.keyboard.press('Escape')
    await reader.waitFor({ state: 'detached' })
    await page.locator('#now .home-gallery').focus()
    await page.keyboard.press('End')
    await page.locator('#now .home-gallery-open').last().click()
    await reader.locator('.live-state-error').waitFor()
    malformed = false
    await reader.locator('.live-refresh-button').click()
    await reader.getByText('还没有收录的文章。', { exact: false }).waitFor()
    assert.equal(await reader.locator('.live-state-error').count(), 0)
    report('PASS: first-load loading, offline recovery, malformed feeds and empty results')
  } finally { release(); await context.close() }
}

export async function runHomeNowMotionChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/data/github.json', route => route.fulfill({ json: snapshot }))
  await page.route('**/data/rss.json', route => route.fulfill({ json: feed }))
  try {
    await page.goto(new URL('home/', baseURL).href)
    const cards = page.locator('#now .home-gallery-open')
    await cards.first().scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1800)
    const background = await page.evaluate(() => ({ y: scrollY, overflow: document.body.style.overflow }))

    // Sample physical geometry at controlled times, independently of how the
    // origin is stored or which transform interpolation the reader uses.
    const opening = await page.evaluate(async () => {
      const button = document.querySelector('#now .home-gallery-open')
      const box = element => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      const source = box(button.querySelector('.home-gallery-window'))
      button.click()
      let reader, motion
      for (let frame = 0; frame < 12 && !motion; frame++) {
        await new Promise(requestAnimationFrame)
        reader = document.querySelector('.home-now-reader')
        motion = reader?.getAnimations().find(animation => !animation.effect?.pseudoElement && animation.effect?.getKeyframes().some(keyframe => keyframe.transform))
      }
      if (!motion) throw new Error('Opening must have a controlled geometric animation')
      motion.pause()
      const duration = Number(motion.effect.getTiming().duration)
      motion.currentTime = 0
      const start = box(reader)
      motion.currentTime = duration * .5
      const middle = box(reader)
      motion.currentTime = duration - .01
      const end = box(reader)
      motion.currentTime = 0
      motion.play()
      return { source, start, middle, end }
    })
    assertBoundsNear(opening.start, opening.source, 'Opening begins at the original cover')
    const distance = (a, b) => ['x', 'y', 'width', 'height'].reduce((total, key) => total + Math.abs(a[key] - b[key]), 0)
    assert.ok(distance(opening.middle, opening.end) < distance(opening.start, opening.end), 'The panel expands continuously toward its reading size')
    assert.ok(distance(opening.middle, opening.start) > 10, 'The midpoint has moved beyond the original card')
    let reader = await waitForReader(page)
    assertBoundsNear(await reader.boundingBox(), opening.end, 'Opening settles without a geometry jump')
    assert.equal(await reader.locator('.home-now-reader-cover').count(), 1, 'The cover participates in the transition')

    // The return destination follows the current card after responsive layout.
    await page.setViewportSize({ width: 768, height: 700 })
    await page.waitForTimeout(120)
    const closing = await page.evaluate(async () => {
      const reader = document.querySelector('.home-now-reader')
      const box = element => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      const before = box(reader)
      reader.querySelector('.home-now-close').click()
      // Closing prepares the focus/hover geometry that will exist on return.
      // The inert, unfocused source before this click is not that destination.
      const sourceElement = document.querySelector('#now .home-gallery-window')
      const source = box(sourceElement)
      const sourceImage = box(sourceElement.querySelector('img'))
      let motion
      for (let frame = 0; frame < 12 && !motion; frame++) {
        await new Promise(requestAnimationFrame)
        motion = reader.getAnimations().find(animation => !animation.effect?.pseudoElement && animation.effect?.getKeyframes().some(keyframe => keyframe.transform))
      }
      if (!motion) throw new Error('Closing must have a controlled geometric animation')
      motion.pause()
      motion.currentTime = 0
      const start = box(reader)
      motion.currentTime = Number(motion.effect.getTiming().duration)
      const end = box(reader)
      motion.finish()
      return { source, sourceImage, before, start, end }
    })
    assertBoundsNear(closing.start, closing.before, 'Closing begins at the current reading panel')
    assertBoundsNear(closing.end, closing.source, 'Closing returns to the resized source cover', 1)
    await reader.waitFor({ state: 'detached' })
    assertBoundsNear(await cards.first().locator('.home-gallery-window').boundingBox(), closing.source,
      'The restored card keeps the exact closing destination', 1)
    assertBoundsNear(await cards.first().locator('img').boundingBox(), closing.sourceImage,
      'The restored source image keeps the closing composition', 1)
    assert.equal(await page.locator('[data-now-returning], [data-now-origin]').count(), 0, 'Return geometry leaves no temporary state')
    assert.equal(await cards.first().evaluate(element => document.activeElement === element), true, 'Closing restores focus to its exact trigger')
    assert.equal(await page.evaluate(() => document.body.style.overflow), background.overflow, 'Closing restores the original body overflow')

    await page.setViewportSize({ width: 1440, height: 1000 })
    await cards.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(180)
    const interruption = await page.evaluate(async () => {
      const button = document.querySelector('#now .home-gallery-open')
      const box = element => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      button.click()
      await new Promise(requestAnimationFrame)
      const reader = document.querySelector('.home-now-reader')
      const motion = reader.getAnimations().find(animation => !animation.effect?.pseudoElement && animation.effect?.getKeyframes().some(keyframe => keyframe.transform))
      if (!motion) throw new Error('The second opening must animate')
      motion.pause()
      motion.currentTime = Number(motion.effect.getTiming().duration) * .22
      const before = box(reader)
      reader.dispatchEvent(new Event('cancel', { cancelable: true }))
      await new Promise(requestAnimationFrame)
      const reverse = reader.getAnimations().find(animation => !animation.effect?.pseudoElement && animation.effect?.getKeyframes().some(keyframe => keyframe.transform))
      if (!reverse) throw new Error('Interrupted opening must create a return animation')
      reverse.pause()
      reverse.currentTime = 0
      const after = box(reader)
      reverse.play()
      return { before, after }
    })
    assertBoundsNear(interruption.after, interruption.before, 'An interrupted opening reverses without jumping')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.locator('.home-now-reader').waitFor({ state: 'detached' })
    assert.equal(await page.locator('dialog:modal').count(), 0, 'Repeated Escape leaves no stale modal')
    assert.equal(await cards.first().evaluate(element => document.activeElement === element), true)
    assert.equal(await page.evaluate(() => document.body.style.overflow), background.overflow)

    for (const viewport of [{ width: 568, height: 320 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport)
      await cards.first().scrollIntoViewIfNeeded()
      await cards.first().click()
      reader = await waitForReader(page)
      await reader.locator('.github-repository').first().waitFor()
      const bounds = await reader.boundingBox()
      assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= viewport.width + 1 &&
        bounds.y + bounds.height <= viewport.height + 1, 'The reader fits narrow and short landscape viewports')
      await assertReaderScroll(reader, page)
      const close = reader.getByRole('button', { name: '关闭近况 / Close', exact: true })
      const closeBounds = await close.boundingBox()
      assert.ok(closeBounds.width >= 44 && closeBounds.height >= 44, 'The close button retains a touch-sized target')
      assert.ok(closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= viewport.height, 'The close button is always reachable')
      const scrollArea = reader.locator('.home-now-reader-scroll')
      await scrollArea.focus()
      await page.keyboard.press('PageDown')
      await page.waitForFunction(() => document.querySelector('.home-now-reader-scroll').scrollTop > 0)
      await scrollArea.evaluate(element => { element.scrollTop = 0 })
      await scrollArea.hover()
      await page.mouse.wheel(0, 500)
      await page.waitForFunction(() => document.querySelector('.home-now-reader-scroll').scrollTop > 0)
      await page.screenshot({ path: `node_modules/.cache/home-now/compact-${viewport.width}x${viewport.height}.png` })
      await close.click()
      await reader.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => document.body.style.overflow), background.overflow)
    }
    assert.deepEqual(errors, [])
    report('PASS: cover-origin morph, seamless reversal, repeated Escape, reopen, resize return, hidden scrollbars and compact viewports')
  } finally { await context.close() }
}

export async function runHomeNowPerformanceChecks(browser, baseURL, report = () => {}) {
  const output = 'node_modules/.cache/home-now'
  await mkdir(output, { recursive: true })
  const results = []
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: 'no-preference' })
    await context.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    })
    const page = await context.newPage()
    await page.route('**/data/github.json', route => route.fulfill({ json: snapshot }))
    await page.route('**/data/rss.json', route => route.fulfill({ json: feed }))
    try {
      await page.goto(new URL('home/', baseURL).href)
      const card = page.locator('#now .home-gallery-open').first()
      await card.scrollIntoViewIfNeeded()
      await page.waitForTimeout(1800)
      await page.evaluate(() => {
        const samples = []
        let previous = 0
        let previousPhase = ''
        let cycle = 0
        let frame = 0
        const record = time => {
          const phase = document.querySelector('.home-now-reader')?.dataset.phase || ''
          if (previous && (['opening', 'closing'].includes(phase) || ['opening', 'closing'].includes(previousPhase))) {
            samples.push({ interval: time - previous, phase: ['opening', 'closing'].includes(phase) ? phase : previousPhase, cycle })
          }
          previous = time
          previousPhase = phase
          frame = requestAnimationFrame(record)
        }
        window.__homeNowPerformance = {
          begin: value => { cycle = value },
          stop: () => { cancelAnimationFrame(frame); return samples },
        }
        frame = requestAnimationFrame(record)
      })
      for (let cycle = 1; cycle <= 5; cycle++) {
        await page.evaluate(value => window.__homeNowPerformance.begin(value), cycle)
        await card.evaluate(element => element.click())
        const reader = await waitForReader(page)
        await page.evaluate(() => document.fonts.ready)
        await reader.locator('.home-now-reader-scene img').evaluate(image => image.decode())
        await reader.getByRole('button', { name: '关闭近况 / Close', exact: true }).click()
        await reader.waitFor({ state: 'detached' })
      }
      const samples = await page.evaluate(() => window.__homeNowPerformance.stop())
      assert.ok(samples.length > 0, 'Animation frame sampling captured the transitions')
      const summarize = values => {
        const sorted = values.map(sample => sample.interval).sort((a, b) => a - b)
        const percentile = fraction => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] || 0
        return {
          frames: sorted.length,
          p50_ms: Number(percentile(.5).toFixed(2)),
          p95_ms: Number(percentile(.95).toFixed(2)),
          max_ms: Number((sorted.at(-1) || 0).toFixed(2)),
          over_50ms: sorted.filter(interval => interval > 50).length,
        }
      }
      const result = {
        viewport: { width, height: width < 600 ? 844 : 1000 },
        cycles: 5,
        cold: summarize(samples.filter(sample => sample.cycle === 1)),
        warm: summarize(samples.filter(sample => sample.cycle > 1)),
        opening: summarize(samples.filter(sample => sample.phase === 'opening')),
        closing: summarize(samples.filter(sample => sample.phase === 'closing')),
        samples,
      }
      results.push(result)
      report(`PERF: ${width}px, 5 open/close cycles; cold p95 ${result.cold.p95_ms}ms (${result.cold.over_50ms} frames >50ms); warm p95 ${result.warm.p95_ms}ms (${result.warm.over_50ms} frames >50ms)`)
    } finally { await context.close() }
  }
  await writeFile(`${output}/performance.json`, `${JSON.stringify({ method: 'requestAnimationFrame intervals during opening and closing; first cycle cold, four warmed cycles; observational only', results }, null, 2)}\n`)
  return results
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const url = process.env.HOME_EDITORIAL_TEST_URL || 'http://localhost:5173/'
    await runHomeNowChecks(browser, url, console.log)
    await runHomeNowFailureChecks(browser, url, console.log)
    await runHomeNowMotionChecks(browser, url, console.log)
  }
  catch (error) { console.error(error.message); process.exitCode = 1 }
  finally { await browser.close() }
}
