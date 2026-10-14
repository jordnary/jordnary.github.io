import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

function galleryState() {
  const section = document.querySelector('#notes')
  const viewport = section.querySelector('.notes-viewport')
  const track = section.querySelector('.notes-track')
  const pinned = section.dataset.pinned === 'true'
  const distance = Math.max(0, track.scrollWidth - viewport.clientWidth)
  const top = Number.parseFloat(getComputedStyle(section).getPropertyValue('--notes-top'))
  const start = section.getBoundingClientRect().top + scrollY - top
  const offset = pinned ? -new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 : viewport.scrollLeft
  return {
    pinned, distance, start, offset, y: scrollY,
    target: Math.max(0, Math.min(distance, scrollY - start)),
    progress: new DOMMatrixReadOnly(getComputedStyle(section.querySelector('.notes-progress > span')).transform).m11,
    transform: track.style.transform,
    stickyTop: section.querySelector('.notes-sticky').getBoundingClientRect().top,
  }
}

async function waitForTrack(page) {
  await page.waitForFunction(() => {
    const section = document.querySelector('#notes')
    const track = section.querySelector('.notes-track')
    const viewport = section.querySelector('.notes-viewport')
    const distance = Math.max(0, track.scrollWidth - viewport.clientWidth)
    const top = Number.parseFloat(getComputedStyle(section).getPropertyValue('--notes-top'))
    const start = section.getBoundingClientRect().top + scrollY - top
    const target = Math.max(0, Math.min(distance, scrollY - start))
    return section.dataset.pinned === 'true' && Math.abs(new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 + target) < 0.5
  })
}

async function jump(page, fraction) {
  const { start, distance } = await page.evaluate(galleryState)
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), start + distance * fraction)
  await waitForTrack(page)
}

async function startTrace(page) {
  await page.evaluate(() => {
    const section = document.querySelector('#notes')
    const track = section.querySelector('.notes-track')
    const viewport = section.querySelector('.notes-viewport')
    const samples = []
    let frame
    const sample = time => {
      const distance = track.scrollWidth - viewport.clientWidth
      const top = Number.parseFloat(getComputedStyle(section).getPropertyValue('--notes-top'))
      const start = section.getBoundingClientRect().top + scrollY - top
      samples.push({
        time, y: scrollY,
        offset: -new DOMMatrixReadOnly(getComputedStyle(track).transform).m41,
        target: Math.max(0, Math.min(distance, scrollY - start)),
        progressOffset: new DOMMatrixReadOnly(getComputedStyle(section.querySelector('.notes-progress > span')).transform).m11 * distance,
      })
      frame = requestAnimationFrame(sample)
    }
    frame = requestAnimationFrame(sample)
    window.stopLearningScrollTrace = () => { cancelAnimationFrame(frame); return samples }
  })
}

async function stopTrace(page) {
  return page.evaluate(() => {
    const samples = window.stopLearningScrollTrace()
    delete window.stopLearningScrollTrace
    return samples
  })
}

export async function runLearningScrollChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-desktop', 'true'))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const cards = page.locator('.note-cover')
  const url = new URL('learning/', baseURL).href
  try {
    await page.goto(`${url}#notes`)
    await page.waitForFunction(() => document.querySelector('#notes')?.dataset.pinned === 'true')
    await page.mouse.move(700, 450)
    await jump(page, 0.2)
    const before = await page.evaluate(galleryState)
    await startTrace(page)
    await page.mouse.wheel(0, 480)
    await page.waitForFunction(y => scrollY >= y + 479, before.y)
    await waitForTrack(page)
    const after = await page.evaluate(galleryState)
    const burst = await stopTrace(page)
    assert.ok(Math.abs(after.y - before.y - 480) < 2, 'The native document receives the complete wheel distance')
    assert.ok(Math.abs(after.offset - before.offset - 480) < 2, 'The displayed track reaches the complete wheel distance')
    assert.ok(Math.abs(after.stickyTop - before.stickyTop) < 2, 'Smoothing preserves the pinned gallery heading')
    const intermediate = burst.filter(sample => sample.offset > before.offset + 2 && sample.offset < after.offset - 2)
    assert.ok(new Set(intermediate.map(sample => sample.offset.toFixed(1))).size >= 3, 'A wheel burst produces multiple distinct intermediate displayed frames')
    assert.ok(burst.some(sample => sample.y >= before.y + 479 && sample.target - sample.offset > 5), 'The visual track smoothly catches up after the native document has reached its target')
    assert.ok(burst.every(sample => Math.abs(sample.progressOffset - sample.offset) < 0.6), 'Progress follows the displayed position on every sampled frame')
    const steps = burst.slice(1).map((sample, index) => sample.offset - burst[index].offset)
    assert.ok(steps.every(step => step >= -0.6), 'A forward burst never reverses or overshoots')
    assert.ok(Math.max(...steps) < 480 * 0.8, 'The display does not jump most of the wheel distance in a single frame')
    pass('A native wheel burst is spread over intermediate displayed frames, with pinned content and matching progress')

    await startTrace(page)
    for (const delta of [160, 160, 160, 160, -220, -220, -220]) await page.mouse.wheel(0, delta)
    await page.waitForFunction(y => Math.abs(scrollY - y + 20) < 2, after.y)
    await waitForTrack(page)
    const reversed = await page.evaluate(galleryState)
    const continuous = await stopTrace(page)
    assert.ok(Math.abs(reversed.offset - after.offset + 20) < 2, 'Continuous and reversing inputs retain their exact net distance')
    assert.ok(continuous.some((sample, index) => index > 0 && sample.offset > continuous[index - 1].offset + 1), 'Continuous forward input advances the displayed cards')
    assert.ok(continuous.some((sample, index) => index > 0 && sample.offset < continuous[index - 1].offset - 1), 'Reversing the wheel reverses the displayed cards')
    assert.ok(continuous.every(sample => sample.offset >= -0.5 && sample.offset <= reversed.distance + 0.5), 'Continuous input never escapes the gallery bounds')
    assert.ok(continuous.every(sample => Math.abs(sample.progressOffset - sample.offset) < 0.6), 'Progress stays synchronized during reversals')
    pass('Continuous and reversed wheel inputs settle accurately without overshoot or progress drift')

    await page.waitForTimeout(150)
    const idleWrites = await page.evaluate(() => new Promise(resolve => {
      const track = document.querySelector('.notes-track')
      let changes = 0
      const observer = new MutationObserver(records => { changes += records.length })
      observer.observe(track, { attributes: true, attributeFilter: ['style'] })
      setTimeout(() => { observer.disconnect(); resolve(changes) }, 220)
    }))
    assert.equal(idleWrites, 0, 'A settled track stops writing animation styles')
    pass('Settled scrolling leaves the track idle')

    await jump(page, 0.98)
    await page.mouse.wheel(0, 500)
    await page.waitForFunction(() => {
      const section = document.querySelector('#notes')
      return section.querySelector('.notes-sticky').getBoundingClientRect().top < 70
    })
    const end = await page.evaluate(galleryState)
    const last = await cards.last().boundingBox()
    assert.ok(Math.abs(end.offset - end.distance) < 0.5, 'Leaving the pinned range immediately exposes the exact track end')
    assert.ok(last.x >= -1 && last.x + last.width <= 1441, 'The last card remains fully visible at the end')
    assert.ok(await page.getByRole('button', { name: '下一篇笔记' }).isDisabled())
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), end.start - 120)
    await page.waitForFunction(() => -new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.notes-track')).transform).m41 === 0)
    assert.ok(await page.getByRole('button', { name: '上一篇笔记' }).isDisabled())
    pass('Leaving either pinned boundary lands exactly at the start or end, and the final card stays fully visible')

    await jump(page, 0)
    await page.getByLabel('难度', { exact: true }).focus()
    const count = await cards.count()
    for (let index = 0; index < count; index++) {
      await page.keyboard.press('Tab')
      const focused = await cards.nth(index).evaluate(element => {
        const bounds = element.getBoundingClientRect()
        return { focused: element === document.activeElement, left: bounds.left, right: bounds.right, width: innerWidth }
      })
      assert.equal(focused.focused, true, `Tab focuses note ${index + 1}`)
      assert.ok(focused.left >= -1 && focused.right <= focused.width + 1, `Focused note ${index + 1} is immediately visible without waiting for damping`)
    }
    pass('Keyboard navigation immediately brings every focused note into view')

    await jump(page, 0.6)
    await page.mouse.wheel(0, 300)
    await page.getByLabel('主题', { exact: true }).selectOption('数据库')
    await page.waitForFunction(() => document.querySelectorAll('.note-cover').length === 3)
    await page.waitForFunction(() => {
      const section = document.querySelector('#notes')
      const transform = section.querySelector('.notes-track').style.transform
      return (!transform || Math.abs(new DOMMatrixReadOnly(transform).m41) < 0.5)
        && section.querySelector('.notes-viewport').scrollLeft === 0
    })
    let filtered = await page.evaluate(galleryState)
    assert.ok(Math.abs(filtered.offset) < 0.5 && Math.abs(filtered.progress * filtered.distance) < 0.5, 'Filtering resets the displayed offset and progress together')
    await page.getByLabel('主题', { exact: true }).selectOption('全部主题')
    await page.waitForFunction(expected => document.querySelectorAll('.note-cover').length === expected, count)
    await waitForTrack(page)
    filtered = await page.evaluate(galleryState)
    assert.ok(Math.abs(filtered.offset) < 0.5 && Math.abs(filtered.progress * filtered.distance) < 0.5, 'Restoring the complete gallery has no stale animation offset')
    pass('Filtering during scrolling resets the gallery and restoring all notes preserves the first position')

    await jump(page, 0.4)
    await page.mouse.wheel(0, 300)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('#notes').dataset.pinned === 'false')
    assert.equal((await page.evaluate(galleryState)).transform, '', 'Reduced motion clears the animated transform')
    await page.getByRole('button', { name: '下一篇笔记' }).click()
    assert.ok((await page.evaluate(galleryState)).offset > 0, 'Reduced motion uses instant native horizontal navigation')
    await page.waitForTimeout(180)
    assert.equal((await page.evaluate(galleryState)).transform, '', 'A pending animation cannot restore the transform after reduced motion is enabled')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.waitForFunction(() => document.querySelector('#notes').dataset.pinned === 'true')
    await jump(page, 0.4)
    await page.mouse.wheel(0, 300)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('#notes').dataset.pinned === 'false')
    assert.equal((await page.evaluate(galleryState)).transform, '', 'The mobile layout clears the animated transform')
    await page.waitForTimeout(180)
    assert.equal((await page.evaluate(galleryState)).transform, '', 'A pending animation cannot restore the transform after switching to mobile')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The mobile layout has no page overflow')
    pass('Reduced motion and mobile layouts cancel in-flight damping and retain native navigation without a stale transform')
    assert.deepEqual(errors, [])
    pass('No uncaught browser errors during scroll transitions')
  } finally {
    await context.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runLearningScrollChecks(browser, process.env.LEARNING_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} learning scroll checks passed`)
  } catch (error) {
    console.error('Learning scroll checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
