import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const menuSelector = 'dialog.project-reader-toc'
const triggerSelector = '.project-reader-index'
const closeSelector = '.project-reader-toc-close'
const tolerance = 2

const waitForState = (page, state) => page.waitForFunction(expected => {
  const menu = document.querySelector('dialog.project-reader-toc')
  return menu?.dataset.state === expected && menu.open === (expected !== 'closed')
}, state, { polling: 'raf' })

async function recordContents(page) {
  const recorder = await page.evaluateHandle(() => {
    const samples = []
    let frame
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    const sample = () => {
      const menu = document.querySelector('dialog.project-reader-toc')
      samples.push({
        time: performance.now(),
        state: menu.dataset.state,
        modal: menu.matches(':modal'),
        opened: menu.open,
        clipPath: getComputedStyle(menu).clipPath,
        menu: rect('dialog.project-reader-toc'),
        scrollY,
        scrollX,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        frame: rect('.project-reader-layout'),
        footer: rect('.project-reader-end'),
        trigger: rect('.project-reader-index'),
        body: rect('.project-reader-scroll'),
        selection: [...document.querySelectorAll('#project-toc-links a')].map(link => ({
          color: getComputedStyle(link).color,
          marker: Number(getComputedStyle(link, '::before').opacity),
        })),
      })
    }
    const tick = () => { sample(); frame = requestAnimationFrame(tick) }
    tick()
    return { stop: () => { cancelAnimationFrame(frame); sample(); return samples } }
  })
  return async () => {
    try { return await recorder.evaluate(value => value.stop()) }
    finally { await recorder.dispose() }
  }
}

function assertStablePage(samples, label) {
  assert.ok(samples.length > 1, `${label}: page position is sampled throughout the interaction`)
  const before = samples[0]
  for (const sample of samples) {
    for (const property of ['scrollY', 'scrollX', 'documentWidth', 'documentHeight', 'clientWidth']) {
      assert.ok(Math.abs(sample[property] - before[property]) < tolerance,
        `${label}: ${property} remains unchanged (${before[property]} -> ${sample[property]})`)
    }
    for (const element of ['frame', 'footer', 'trigger', 'body']) {
      for (const property of ['x', 'y', 'width', 'height']) {
        assert.ok(Math.abs(sample[element][property] - before[element][property]) < tolerance,
          `${label}: ${element}.${property} remains unchanged`)
      }
    }
  }
}

function polygonFor(sample) {
  const match = sample.clipPath.match(/^polygon\((.*)\)$/)
  assert.ok(match, `${sample.state}: the visible menu is revealed with a polygon clip`)
  const points = match[1].replace(/^(?:evenodd|nonzero),\s*/, '').split(',').map(pair => {
    const coordinate = pair.trim().match(/^(-?[\d.]+)(%|px)?\s+(-?[\d.]+)(%|px)?$/)
    assert.ok(coordinate, 'Computed clip coordinates are measurable percentages or pixels')
    return [
      Number(coordinate[1]) / (coordinate[2] === '%' ? 100 : sample.menu.width),
      Number(coordinate[3]) / (coordinate[4] === '%' ? 100 : sample.menu.height),
    ]
  })
  const area = Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0)) / 2
  return { points, area }
}

function contains(points, x, y) {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[previous]
    if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}

function assertWave(samples, state) {
  const frames = samples.filter(sample => sample.state === state && sample.opened)
  assert.ok(frames.length >= 5, `${state}: several intermediate frames are visible`)
  assert.ok(frames.every(frame => frame.modal), `${state}: the dialog stays modal until the transition completes`)
  const polygons = frames.map(polygonFor)
  const areas = polygons.map(polygon => polygon.area)
  assert.ok(Math.max(...areas) - Math.min(...areas) > 0.7, `${state}: clipping reveals or hides most of the panel`)
  const duration = frames.at(-1).time - frames[0].time
  assert.ok(duration >= (state === 'opening' ? 250 : 180) && duration < 1100,
    `${state}: animation has a visible, bounded duration (${Math.round(duration)}ms)`)
  for (let index = 1; index < areas.length; index++) {
    assert.ok(state === 'opening' ? areas[index] >= areas[index - 1] - 0.015 : areas[index] <= areas[index - 1] + 0.015,
      `${state}: the visible area changes in the correct direction`)
  }
  const middle = polygons.filter(polygon => polygon.area > 0.08 && polygon.area < 0.8)
  assert.ok(middle.some(({ points }) => contains(points, 0.03, 0.97) && !contains(points, 0.97, 0.03)),
    `${state}: the lower-left corner is revealed before the upper-right corner`)
  assert.ok(middle.some(({ points }) => {
    const edges = points.map((point, index) => {
      const next = points[(index + 1) % points.length]
      return { dx: Math.abs(point[0] - next[0]), dy: Math.abs(point[1] - next[1]) }
    }).filter(edge => edge.dx + edge.dy > 0.002)
    return edges.length >= 8 && edges.every(edge => edge.dx < 0.002 || edge.dy < 0.002)
  }), `${state}: a stepped square boundary is visible during the wave`)
  for (const frame of frames) {
    for (const property of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(frame.menu[property] - frames[0].menu[property]) < tolerance,
        `${state}: the panel box stays fixed while its clipping changes`)
    }
  }
}

async function assertPlacement(page, label) {
  const placement = await page.locator(menuSelector).evaluate(menu => {
    const rect = element => {
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    return {
      menu: rect(menu),
      trigger: rect(document.querySelector('.project-reader-index')),
      position: getComputedStyle(menu).position,
      viewport: { width: innerWidth, height: innerHeight },
      overflow: menu.scrollWidth - menu.clientWidth,
    }
  })
  const { menu, trigger, viewport } = placement
  assert.equal(placement.position, 'fixed', `${label}: contents are outside document flow`)
  assert.ok(menu.left >= -1 && menu.top >= -1 && menu.right <= viewport.width + 1 && menu.bottom <= viewport.height + 1,
    `${label}: the menu fits the viewport`)
  assert.ok(menu.left <= trigger.left + tolerance && menu.right >= trigger.right - tolerance
    && menu.top <= trigger.top + tolerance && menu.bottom >= trigger.bottom - tolerance,
  `${label}: the open menu covers the complete Index button`)
  assert.ok(trigger.left - menu.left <= 32 && menu.bottom - trigger.bottom <= 32,
    `${label}: the menu lower-left corner remains anchored to Index`)
  assert.ok(placement.overflow <= 1, `${label}: menu content does not overflow horizontally`)
}

async function waitForFrames(page, count = 3) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => { if (--count <= 0) resolve(); else requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }), count)
}

export async function runProjectContentsChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  const checks = []
  let checkedScrollableContents = false
  const pass = name => { checks.push(name); report(name) }
  const trigger = () => page.locator(triggerSelector)
  const menu = () => page.locator(menuSelector)
  const close = () => page.locator(closeSelector)
  const expectHighlight = async index => {
    await page.waitForFunction(index => {
      const links = [...document.querySelectorAll('#project-toc-links a')]
      const ink = getComputedStyle(document.querySelector('dialog.project-reader-toc')).color
      return links.every((link, position) =>
        (getComputedStyle(link).color === ink) === (position === index)
        && Number(getComputedStyle(link, '::before').opacity) === (position === index ? 1 : 0))
    }, index)
    const appearance = await page.locator('#project-toc-links a').evaluateAll(links => {
      const ink = getComputedStyle(document.querySelector('dialog.project-reader-toc')).color
      return {
        highlighted: links.flatMap((link, index) => getComputedStyle(link).color === ink ? [index] : []),
        markers: links.flatMap((link, index) => {
          const marker = getComputedStyle(link, '::before')
          return marker.content !== 'none' && Number(marker.opacity) > 0 ? [index] : []
        }),
        backgrounds: links.map(link => getComputedStyle(link).backgroundColor),
      }
    })
    assert.deepEqual(appearance.highlighted, [index], 'Exactly one chapter uses the original ink text treatment')
    assert.deepEqual(appearance.markers, [index], 'Only that chapter displays the original dot marker')
    assert.ok(appearance.backgrounds.every(color => color === 'rgba(0, 0, 0, 0)'), 'Chapter selection keeps the original unfilled background')
    assert.equal(await page.locator('#project-toc-links a[aria-current="location"]').count(), 1,
      'Hover and focus retain one semantic current chapter')
  }
  const open = async () => { await trigger().click(); await waitForState(page, 'open') }
  const released = async () => {
    await waitForState(page, 'closed')
    assert.equal(await trigger().getAttribute('aria-expanded'), 'false')
    assert.ok(await trigger().evaluate(element => element === document.activeElement), 'Dismissal restores focus to Index')
  }
  const prepareReader = async viewport => {
    await page.setViewportSize(viewport)
    const url = new URL('projects/triton-attention-optimization/', baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
    const response = await page.goto(url.href)
    assert.equal(response.status(), 200)
    await page.locator('.project-introduction').waitFor()
    await page.waitForFunction(() => document.querySelector('.project-reader-layout')?.dataset.phase === 'idle')
    await page.evaluate(() => document.fonts.ready)
    await trigger().scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const trigger = document.querySelector('.project-reader-index')
      window.scrollBy({ top: trigger.getBoundingClientRect().bottom - (innerHeight - 42), behavior: 'instant' })
    })
    await waitForFrames(page)
    await waitForState(page, 'closed')
    assert.equal(await trigger().getAttribute('aria-expanded'), 'false')
    assert.ok(await page.evaluate(() => scrollY > 100), 'Scroll checks begin in the reading area, away from the page origin')
  }
  page.on('pageerror', error => errors.push(error.message))
  try {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 1100, height: 480 },
    ]) {
      const label = `${viewport.width}x${viewport.height}`
      await prepareReader(viewport)
      let stop = await recordContents(page)
      await open()
      const opening = await stop()
      assertWave(opening, 'opening')
      assertStablePage(opening, `${label} opening`)
      assert.equal(await trigger().getAttribute('aria-expanded'), 'true')
      assert.ok(await menu().evaluate(element => element.matches(':modal')))
      await assertPlacement(page, label)
      assert.equal(await menu().evaluate(element => getComputedStyle(element, '::backdrop').backgroundColor), 'rgba(0, 0, 0, 0)',
        'The modal backdrop leaves the page undimmed')
      await expectHighlight(0)
      stop = await recordContents(page)
      await page.locator('#project-toc-links a').nth(1).hover()
      await expectHighlight(1)
      const selectionFade = await stop()
      assert.ok(selectionFade.some(sample => sample.selection[1].color !== selectionFade[0].selection[1].color
        && sample.selection[1].color !== selectionFade.at(-1).selection[1].color), 'Chapter text fades through intermediate colors')
      assert.ok(selectionFade.some(sample => sample.selection[1].marker > 0 && sample.selection[1].marker < 1),
        'The incoming dot fades in')
      assert.ok(selectionFade.every(sample => sample.selection.filter(chapter => chapter.marker > 0).length <= 1),
        'The outgoing dot never overlaps the incoming dot')
      assertStablePage(selectionFade, `${label} selection fade`)
      await page.mouse.move(viewport.width - 2, 2)
      await expectHighlight(0)
      await close().focus()
      await page.keyboard.press('Tab')
      await expectHighlight(0)
      await page.keyboard.press('Tab')
      await expectHighlight(1)
      await page.locator('#project-toc-links a').nth(2).hover()
      await expectHighlight(1)
      await close().focus()
      await page.mouse.move(viewport.width - 2, 2)
      await expectHighlight(0)

      stop = await recordContents(page)
      for (const index of [1, 3, 4, 0]) {
        await page.locator('#project-toc-links a').nth(index).hover()
        await waitForFrames(page, 2)
      }
      await expectHighlight(0)
      const rapidSelection = await stop()
      assert.ok(rapidSelection.every(sample => sample.selection.filter(chapter => chapter.marker > 0).length <= 1),
        'Rapid pointer changes cancel outgoing dot fades without accumulating selected markers')
      assertStablePage(rapidSelection, `${label} rapid selection changes`)

      stop = await recordContents(page)
      const nav = page.locator('#project-toc-links')
      await nav.hover()
      await page.mouse.wheel(0, 600)
      await waitForFrames(page, 6)
      await page.mouse.wheel(0, -600)
      await waitForFrames(page, 6)
      await page.mouse.move(viewport.width - 2, 2)
      await page.mouse.wheel(0, -450)
      await waitForFrames(page, 6)
      await page.mouse.wheel(0, 450)
      await waitForFrames(page, 6)
      assertStablePage(await stop(), `${label} wheel scrolling`)

      stop = await recordContents(page)
      for (const key of ['PageDown', 'End', 'ArrowDown', 'PageUp', 'Home', 'ArrowUp', 'Space']) {
        const upward = ['PageUp', 'Home', 'ArrowUp'].includes(key)
        const before = await nav.evaluate((element, upward) => {
          element.scrollTo({ top: upward ? element.scrollHeight : 0, behavior: 'instant' })
          element.querySelector('a').focus({ preventScroll: true })
          return { top: element.scrollTop, maximum: element.scrollHeight - element.clientHeight }
        }, upward)
        await page.keyboard.press(key)
        await waitForFrames(page, 6)
        const after = await nav.evaluate(element => element.scrollTop)
        if (before.maximum > tolerance) {
          checkedScrollableContents = true
          assert.ok(upward ? after < before.top - 1 : after > before.top + 1,
            `${label}: ${key} scrolls the overflowing contents in the expected direction`)
        } else {
          assert.ok(Math.abs(after - before.top) < tolerance,
            `${label}: ${key} does not create scrolling in a menu that already fits`)
        }
        await nav.evaluate((element, upward) => {
          element.scrollTo({ top: upward ? 0 : element.scrollHeight, behavior: 'instant' })
        }, upward)
        await page.keyboard.press(key)
        await waitForFrames(page, 6)
      }
      assertStablePage(await stop(), `${label} keyboard scrolling and boundary chaining`)

      for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
        for (let index = 0; index < 8; index++) {
          await page.keyboard.press(key)
          assert.ok(await menu().evaluate(element => !document.hasFocus() || element.contains(document.activeElement)),
            `${label}: native modal keyboard navigation stays inside the menu or browser chrome`)
        }
      }
      stop = await recordContents(page)
      await close().click()
      await released()
      const closing = await stop()
      assertWave(closing, 'closing')
      assertStablePage(closing, `${label} closing`)

      stop = await recordContents(page)
      await open()
      const chapter = page.locator('#project-toc-links a').nth(2)
      assert.ok(await chapter.evaluate(element => element.hasAttribute('data-preserve-scroll')))
      const hash = await chapter.getAttribute('href')
      await chapter.click()
      await waitForState(page, 'closed')
      await page.waitForFunction(hash => {
        const frame = document.querySelector('.project-reader-layout')
        return frame?.dataset.chapter === hash.replace('#project-', '') && frame.dataset.phase === 'idle'
      }, hash)
      await waitForFrames(page)
      assertStablePage(await stop(), `${label} selecting another chapter`)
      assert.equal(new URL(page.url()).hash, hash, 'Selecting a chapter still updates its URL')
      assert.equal(await page.locator('.project-reader-scroll').evaluate(element => element.scrollTop), 0,
        'Selecting a chapter resets only its article scroll')
      assert.equal(await trigger().getAttribute('aria-expanded'), 'false')

      stop = await recordContents(page)
      await open()
      await expectHighlight(2)
      await page.locator('#project-toc-links a[aria-current="location"]').click()
      await waitForState(page, 'closed')
      await waitForFrames(page)
      assertStablePage(await stop(), `${label} selecting the current chapter`)
      pass(`${label}: anchored square-wave contents preserve layout and page scroll through opening, closing, wheel and keyboard input, and chapter selection`)
    }
    assert.ok(checkedScrollableContents, 'At least one viewport verifies actual keyboard scrolling inside overflowing contents')

    await prepareReader({ width: 1440, height: 1000 })
    let stop = await recordContents(page)
    await open()
    await page.keyboard.press('Escape')
    await released()
    assertStablePage(await stop(), 'Escape dismissal')
    stop = await recordContents(page)
    await open()
    await page.mouse.click(1438, 2)
    await released()
    assertStablePage(await stop(), 'Backdrop dismissal')
    pass('Escape and backdrop dismissal restore focus and preserve page layout')

    stop = await recordContents(page)
    await trigger().evaluate(element => element.click())
    await waitForState(page, 'opening')
    await waitForFrames(page, 5)
    await page.keyboard.press('Escape')
    await waitForState(page, 'closing')
    await page.keyboard.press('Escape')
    await released()
    const interrupted = await stop()
    assert.ok(interrupted.some(sample => sample.state === 'opening') && interrupted.some(sample => sample.state === 'closing'),
      'Closing during opening completes both lifecycle phases')
    assert.ok(interrupted.filter(sample => sample.state === 'closing').every(sample => sample.modal),
      'Interrupted closing retains native modality through its animation')
    const lastOpening = interrupted.filter(sample => sample.state === 'opening').at(-1)
    const interruptedClosing = interrupted.filter(sample => sample.state === 'closing').map(polygonFor)
    assert.ok(interruptedClosing[0].area <= polygonFor(lastOpening).area + 0.12,
      'Interrupting the reveal reverses from its current shape without flashing a fully open menu')
    for (let index = 1; index < interruptedClosing.length; index++) {
      assert.ok(interruptedClosing[index].area <= interruptedClosing[index - 1].area + 0.015,
        'The interrupted wave keeps shrinking toward the lower-left corner')
    }
    assertStablePage(interrupted, 'Interrupted opening')
    for (let index = 0; index < 3; index++) {
      await open()
      await close().click()
      await released()
    }
    pass('Closing an unfinished opening and repeated toggles leave no stale dialog state')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    stop = await recordContents(page)
    const reduced = await page.evaluate(async () => {
      const menu = document.querySelector('dialog.project-reader-toc')
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
      document.querySelector('.project-reader-index').click()
      await nextFrame()
      await nextFrame()
      const opening = { state: menu.dataset.state, modal: menu.matches(':modal'), animations: menu.getAnimations({ subtree: true }).filter(value => value.playState === 'running').length }
      menu.querySelector('.project-reader-toc-close').click()
      await nextFrame()
      await nextFrame()
      return { opening, closing: { state: menu.dataset.state, opened: menu.open } }
    })
    assert.deepEqual(reduced.opening, { state: 'open', modal: true, animations: 0 }, 'Reduced motion opens immediately without running animation')
    assert.deepEqual(reduced.closing, { state: 'closed', opened: false }, 'Reduced motion closes immediately')
    await released()
    assertStablePage(await stop(), 'Reduced motion')
    assert.deepEqual(errors, [], 'Contents interactions have no uncaught browser errors')
    pass('Reduced motion changes state immediately while retaining modal behavior and stable layout')
    return checks
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runProjectContentsChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:4173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} project contents checks passed`)
  } catch (error) {
    const location = error.stack?.match(/project-contents\.browser\.mjs:\d+:\d+/)?.[0]
    console.error('Project contents checks failed:', error.message, location ?? '')
    process.exitCode = 1
  } finally { await browser.close() }
}
