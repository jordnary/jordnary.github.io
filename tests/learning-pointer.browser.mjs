import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const trailSelector = 'canvas.learning-pointer-trail'

async function waitForPointerLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    let previous = ''
    let stableFrames = 0
    for (let frame = 0; frame < 120; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const cover = document.querySelector('.learning-cover-image').getBoundingClientRect()
      const current = [scrollX, scrollY, innerWidth, innerHeight, document.documentElement.scrollHeight,
        cover.left, cover.top, cover.width, cover.height].join(',')
      stableFrames = current === previous ? stableFrames + 1 : 0
      previous = current
      // Let queued scroll events refresh the clipping masks before pointer input.
      if (stableFrames >= 2) return
    }
    throw new Error('The Learning layout did not settle before pointer input')
  })
}

async function activateTrail(page, selector = '#skills .learning-panel-diagram') {
  const target = page.locator(selector).first()
  await target.scrollIntoViewIfNeeded()
  await waitForPointerLayout(page)
  const box = await target.boundingBox()
  const x = box.x + Math.min(box.width * 0.3, 90)
  const y = box.y + Math.min(box.height * 0.5, 80)
  await page.mouse.move(x, y)
  await page.mouse.move(x + Math.min(box.width * 0.4, 150), y + 8, { steps: 12 })
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.active === 'true', trailSelector)
}

async function assertCleared(page, label) {
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.active === 'false', trailSelector)
    .catch(error => { throw new Error(`${label}: ${error.message}`) })
  assert.equal(await page.locator(trailSelector).evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    return pixels.some((value, index) => index % 4 === 3 && value > 0)
  }), false, `${label} clears both the marker and its trail pixels`)
}

async function assertCoverMasked(page, label) {
  const state = await page.locator(trailSelector).evaluate(async canvas => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const cover = document.querySelector('.learning-cover-image').getBoundingClientRect()
    const scaleX = canvas.width / innerWidth
    const scaleY = canvas.height / innerHeight
    const left = Math.max(0, Math.ceil(cover.left * scaleX))
    const top = Math.max(0, Math.ceil(cover.top * scaleY))
    const right = Math.min(canvas.width, Math.floor(cover.right * scaleX))
    const bottom = Math.min(canvas.height, Math.floor(cover.bottom * scaleY))
    if (right <= left || bottom <= top) return { area: 0 }
    const pixels = canvas.getContext('2d').getImageData(left, top, right - left, bottom - top).data
    return {
      area: (right - left) * (bottom - top),
      hasInk: pixels.some((value, index) => index % 4 === 3 && value > 0),
      active: canvas.dataset.active,
      scaleX,
      scaleY,
    }
  })
  assert.ok(state.area > 0, `${label} samples a visible cover area using the canvas's actual pixel scale`)
  assert.equal(state.active, 'true', `${label} retains the pointer effect outside the cover`)
  assert.equal(state.hasInk, false, `${label} clips all marker and trail pixels out of the cover`)
}

async function sampleTrailAtSpeed(page, pixelsPerMillisecond, options = {}) {
  await page.locator('#skills .learning-panel-diagram').first().scrollIntoViewIfNeeded()
  await waitForPointerLayout(page)
  return page.evaluate(async ({ speed, traverse = false, settle = 0 }) => {
    const canvas = document.querySelector('canvas.learning-pointer-trail')
    const diagram = document.querySelector('#skills .learning-panel-diagram').getBoundingClientRect()
    const grid = document.querySelector('#skills .knowledge-card-grid').getBoundingClientRect()
    const startX = grid.left + 32
    const y = diagram.top + Math.min(diagram.height / 2, 100)
    const distance = traverse ? grid.right - 17 - startX : speed * 560
    const duration = distance / speed
    if (startX + distance >= grid.right - 16) throw new Error('The controlled pointer path must stay within the knowledge map')
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
    const move = x => document.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: x, clientY: y }))
    document.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'mouse' }))
    const start = await nextFrame()
    move(startX)
    let elapsed = 0
    while (elapsed < duration) {
      elapsed = Math.min((await nextFrame()) - start, duration)
      move(startX + speed * elapsed)
    }
    await nextFrame()
    if (settle > 0) {
      const settleStart = await nextFrame()
      while ((await nextFrame()) - settleStart < settle) { /* Sample after the head approaches its endpoint. */ }
    }

    const scaleX = canvas.width / innerWidth
    const scaleY = canvas.height / innerHeight
    const left = Math.floor((startX - 12) * scaleX)
    const top = Math.floor((y - 12) * scaleY)
    const width = Math.ceil((distance + 24) * scaleX)
    const height = Math.ceil(24 * scaleY)
    const pixels = canvas.getContext('2d').getImageData(left, top, width, height).data
    let markerLeft = width
    let markerTop = height
    let markerRight = -1
    let markerBottom = -1
    let inkLeft = width
    let inkRight = -1
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const alpha = pixels[(row * width + column) * 4 + 3]
        if (alpha > 0) {
          inkLeft = Math.min(inkLeft, column)
          inkRight = Math.max(inkRight, column)
        }
        // Sample the square above and below the thin trail, including any overlapping joins.
        if (alpha > 220 && Math.abs((top + row) / scaleY - y) > 2) {
          markerLeft = Math.min(markerLeft, column)
          markerRight = Math.max(markerRight, column)
          markerTop = Math.min(markerTop, row)
          markerBottom = Math.max(markerBottom, row)
        }
      }
    }
    let tailAlpha = 0
    let tailMaxAlpha = 0
    let tailPixels = 0
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        // Also exclude the marker's antialiased edge at the actual canvas scale.
        if (column >= markerLeft - 2 * scaleX && column <= markerRight + 2 * scaleX
          && row >= markerTop - 2 * scaleY && row <= markerBottom + 2 * scaleY) continue
        const alpha = pixels[(row * width + column) * 4 + 3]
        tailAlpha += alpha
        tailMaxAlpha = Math.max(tailMaxAlpha, alpha)
        if (alpha > 0) tailPixels++
      }
    }
    return {
      active: canvas.dataset.active,
      tailAlpha,
      tailMaxAlpha,
      tailPixels,
      travelDistance: distance,
      viewportWidth: innerWidth,
      inkSpan: (inkRight - inkLeft + 1) / scaleX,
      markerWidth: (markerRight - markerLeft + 1) / scaleX,
      markerHeight: (markerBottom - markerTop + 1) / scaleY,
      markerLag: startX + distance - (left + (markerLeft + markerRight + 1) / 2) / scaleX,
      strokeWidths: [...window.__learningPointerStrokeWidths],
    }
  }, { speed: pixelsPerMillisecond, ...options })
}

async function samplePressFeedback(page, button, buttons, chord = false) {
  await page.locator('#skills .learning-panel-diagram').first().scrollIntoViewIfNeeded()
  await waitForPointerLayout(page)
  return page.evaluate(async ({ button, buttons, chord }) => {
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
    const canvas = document.querySelector('canvas.learning-pointer-trail')
    const box = document.querySelector('#skills .learning-panel-diagram').getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const scaleX = canvas.width / innerWidth
    const scaleY = canvas.height / innerHeight
    const regionWidth = Math.ceil(64 * scaleX)
    const regionHeight = Math.ceil(64 * scaleY)
    const regionLeft = Math.floor((x - 32) * scaleX)
    const regionTop = Math.floor((y - 32) * scaleY)
    const dispatch = (type, buttons = 0, changedButton = button) => document.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', clientX: x, clientY: y, button: changedButton, buttons, bubbles: true }))
    const sample = () => {
      const pixels = canvas.getContext('2d').getImageData(regionLeft, regionTop, regionWidth, regionHeight).data
      let left = regionWidth
      let right = -1
      let top = regionHeight
      let bottom = -1
      let outerPixels = 0
      for (let row = 0; row < regionHeight; row++) {
        for (let column = 0; column < regionWidth; column++) {
          if (pixels[(row * regionWidth + column) * 4 + 3] === 0) continue
          left = Math.min(left, column)
          right = Math.max(right, column)
          top = Math.min(top, row)
          bottom = Math.max(bottom, row)
          const pixelX = (regionLeft + column) / scaleX
          const pixelY = (regionTop + row) / scaleY
          if (Math.abs(pixelX - x) > 6 || Math.abs(pixelY - y) > 6) outerPixels++
        }
      }
      return { width: (right - left + 1) / scaleX, height: (bottom - top + 1) / scaleY, outerPixels }
    }
    dispatch('pointercancel')
    dispatch('pointermove')
    await nextFrame()
    const idle = sample()
    const started = performance.now()
    dispatch('pointerdown', buttons)
    const growth = []
    while ((await nextFrame()) - started < 400) growth.push(sample())
    const held = sample()
    for (let frame = 0; frame < 6; frame++) await nextFrame()
    const stillHeld = sample()
    let partlyReleased
    if (chord) {
      dispatch('pointermove', buttons | 8, 3)
      await nextFrame()
      dispatch('pointermove', 8)
      await nextFrame()
      partlyReleased = sample()
    }
    dispatch('pointerup', 0, chord ? 3 : button)
    await nextFrame()
    const released = sample()
    return { idle, growth, held, stillHeld, partlyReleased, released }
  }, { button, buttons, chord })
}

export async function runLearningPointerChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const url = new URL('learning/', baseURL).href
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    // Observe actual canvas stroke widths independently of their opacity.
    window.__learningPointerStrokeWidths = []
    window.__learningPointerDraws = 0
    window.__learningPointerHitTests = 0
    window.__learningPointerHead = null
    const clearRect = CanvasRenderingContext2D.prototype.clearRect
    const stroke = CanvasRenderingContext2D.prototype.stroke
    const fillRect = CanvasRenderingContext2D.prototype.fillRect
    const elementFromPoint = document.elementFromPoint
    document.elementFromPoint = function (...args) {
      window.__learningPointerHitTests++
      return elementFromPoint.apply(this, args)
    }
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      if (this.canvas.matches('canvas.learning-pointer-trail') && width === 10 && height === 10) {
        window.__learningPointerDraws++
        window.__learningPointerHead = { x: x + width / 2, y: y + height / 2 }
      }
      return fillRect.call(this, x, y, width, height)
    }
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.matches('canvas.learning-pointer-trail')) window.__learningPointerStrokeWidths = []
      return clearRect.apply(this, args)
    }
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      if (this.canvas.matches('canvas.learning-pointer-trail')) window.__learningPointerStrokeWidths.push(this.lineWidth)
      return stroke.apply(this, args)
    }
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(url)
    const trail = page.locator(trailSelector)
    assert.equal(await trail.count(), 1)
    assert.equal(await trail.getAttribute('aria-hidden'), 'true')
    assert.equal(await trail.evaluate(canvas => getComputedStyle(canvas).pointerEvents), 'none')
    for (const selector of [
      '.learning-hero-scene', '.learning-contents a[href="#skills"]',
      '.learning-contents a[href="#notes"]', '.learning-contents a[href="#timeline"]',
      '#skills .learning-panel-diagram', '#notes .notes-gallery-heading h2', '#timeline .learning-panel-diagram',
    ]) {
      await activateTrail(page, selector)
    }
    pass('A single noninteractive trail follows the pointer over the lower architectural scene, all three contents links, and the Learning content sections')

    await page.locator('.learning-cover-image').scrollIntoViewIfNeeded()
    await waitForPointerLayout(page)
    const coverBoundary = await page.evaluate(() => {
      const cover = document.querySelector('.learning-cover-image').getBoundingClientRect()
      const outer = document.querySelector('.learning-cover').getBoundingClientRect()
      const navigation = document.querySelector('.nav-shell').getBoundingClientRect()
      const top = Math.max(cover.top + 1, navigation.bottom + 20)
      const bottom = Math.min(cover.bottom - 1, innerHeight - 20)
      return {
        leftGutter: (outer.left + cover.left) / 2,
        rightGutter: (cover.right + outer.right) / 2,
        left: cover.left,
        right: cover.right,
        y: (top + bottom) / 2,
      }
    })
    for (const [gutter, edge, label] of [
      [coverBoundary.leftGutter, coverBoundary.left - 1, 'The left cover gutter'],
      [coverBoundary.rightGutter, coverBoundary.right + 1, 'The right cover gutter'],
    ]) {
      await page.mouse.move(gutter, coverBoundary.y)
      await page.waitForFunction(selector => document.querySelector(selector)?.dataset.active === 'true', trailSelector)
      await assertCoverMasked(page, label)
      await page.mouse.move(edge, coverBoundary.y - 35)
      await page.mouse.move(edge, coverBoundary.y + 35, { steps: 12 })
      await assertCoverMasked(page, `${label} during movement along the cover boundary`)
    }
    await page.mouse.move((coverBoundary.left + coverBoundary.right) / 2, coverBoundary.y)
    await assertCleared(page, 'Moving from a gutter into the opening artwork')
    pass('Both opening-cover gutters retain the trail while the artwork stays pixel-clear along its boundaries at the actual device scale')

    const slow = await sampleTrailAtSpeed(page, 0.02)
    const gentle = await sampleTrailAtSpeed(page, 0.12)
    const fast = await sampleTrailAtSpeed(page, 0.9)
    assert.equal(slow.active, 'true')
    assert.equal(fast.active, 'true')
    assert.ok(slow.tailMaxAlpha <= 8, 'Slow motion leaves an absent or nearly transparent trail after excluding the marker')
    assert.ok(fast.tailMaxAlpha > slow.tailMaxAlpha + 25, 'Fast motion produces a visibly darker trail than slow motion')
    assert.ok(fast.tailPixels > 20 && fast.tailAlpha > slow.tailAlpha + 500, 'Fast motion draws a measurable trail independently of the marker pixels')
    assert.ok(fast.travelDistance > 400 && fast.inkSpan > 170, `A fast sweep can extend beyond the old fixed trail limit (observed ${fast.inkSpan} CSS pixels)`)
    assert.ok(fast.inkSpan <= fast.viewportWidth / 2 + 12, 'The trail stays within half of the viewport plus the marker and antialiasing')
    assert.ok(fast.strokeWidths.length > 3, 'The visible trail contains multiple canvas stroke segments')
    assert.ok(fast.strokeWidths[0] < fast.strokeWidths.at(-1) * 0.6 && fast.strokeWidths.at(-1) >= 1.2, 'The tail is physically thinner than the stroke nearest the marker')
    assert.ok(fast.strokeWidths.every((width, index, widths) => width >= 0.1 && width <= 1.7 && (index === 0 || width >= widths[index - 1] - 0.001)), 'Actual canvas line widths progressively increase toward the marker independently of alpha')
    for (const sample of [slow, fast]) {
      assert.ok(sample.markerWidth >= 9 && sample.markerWidth <= 11 && sample.markerHeight >= 9 && sample.markerHeight <= 11, 'The square stays about ten CSS pixels wide at either movement speed')
    }
    pass('Slow and fast movement adjusts trail darkness, and actual stroke widths taper from the marker to the thin tail')

    assert.ok(gentle.markerLag >= 2 && gentle.markerLag <= 14, `Gentle movement retains a small trailing offset (observed ${gentle.markerLag}px)`)
    assert.ok(Math.abs(fast.markerLag) <= 2, `Fast movement puts the square almost on the pointer (observed ${fast.markerLag}px)`)
    assert.ok(gentle.markerLag > fast.markerLag + 2, 'Tracking becomes tighter as pointer speed increases')
    const faded = await sampleTrailAtSpeed(page, 0.9, { settle: 360 })
    assert.equal(faded.tailPixels, 0, 'The fast trail disappears within 360ms of stopping')
    assert.ok(Math.abs(faded.markerLag) <= 1 && faded.markerWidth >= 9, 'The stationary square remains at the pointer after the shortened trail expires')
    pass('Gentle motion follows softly, fast motion tracks within two pixels, and the trail expires promptly after stopping')

    const burst = await page.evaluate(async () => {
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
      const diagram = document.querySelector('#skills .learning-panel-diagram').getBoundingClientRect()
      const grid = document.querySelector('#skills .knowledge-card-grid').getBoundingClientRect()
      const x = grid.left + 32
      const y = diagram.top + Math.min(diagram.height / 2, 100)
      const move = targetX => document.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: targetX, clientY: y }))
      document.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'mouse' }))
      move(x)
      await nextFrame()
      const reads = window.__learningPointerHitTests
      const draws = window.__learningPointerDraws
      for (let event = 1; event <= 240; event++) {
        move(x + event)
        window.dispatchEvent(new Event('scroll'))
      }
      const readsDuringBurst = window.__learningPointerHitTests - reads
      const drawsDuringBurst = window.__learningPointerDraws - draws
      await nextFrame()
      const forwardLag = x + 240 - window.__learningPointerHead.x
      const drawsAfterBurst = window.__learningPointerDraws - draws
      move(x + 20)
      await nextFrame()
      const reverseLag = window.__learningPointerHead.x - (x + 20)
      const stopped = await nextFrame()
      while ((await nextFrame()) - stopped < 420) { /* Let the short history expire. */ }
      const settledDraws = window.__learningPointerDraws
      for (let frame = 0; frame < 6; frame++) await nextFrame()
      return { readsDuringBurst, drawsDuringBurst, drawsAfterBurst, forwardLag, reverseLag, idleDraws: window.__learningPointerDraws - settledDraws }
    })
    assert.equal(burst.readsDuringBurst, 0, 'A burst of pointer input performs no repeated hit testing between frames')
    assert.equal(burst.drawsDuringBurst, 0, 'High-frequency pointer input does not draw between animation frames')
    assert.equal(burst.drawsAfterBurst, 1, 'One frame renders the latest position from the complete input burst')
    assert.ok(Math.abs(burst.forwardLag) < 1 && Math.abs(burst.reverseLag) < 1, `Fast sweeps and reversals catch the latest pointer position in one frame (observed ${JSON.stringify(burst)})`)
    assert.equal(burst.idleDraws, 0, 'Rendering stops once the pointer settles and the trail has faded')
    pass('High-frequency pointer and scroll input share one frame; fast reversals stay responsive and the settled marker requires no rendering loop')

    for (const width of [480, 720]) {
      await page.setViewportSize({ width, height: 900 })
      const bounded = await sampleTrailAtSpeed(page, 3, { traverse: true, settle: 140 })
      assert.ok(bounded.travelDistance > width / 2, `The ${width}px sweep exercises the viewport-relative length limit`)
      assert.ok(bounded.tailPixels > 20 && bounded.inkSpan > width * 0.35, 'A long fast sweep retains a substantial visible tail')
      assert.ok(bounded.inkSpan <= width / 2 + 12, `The visible trail adapts to half of a ${width}px viewport (observed ${bounded.inkSpan} CSS pixels)`)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    pass('Fast sweeps use the viewport-relative length limit and adapt after resizing')

    for (const [button, buttons, label] of [[0, 1, 'Left'], [1, 4, 'Middle'], [2, 2, 'Right'], [3, 8, 'Back'], [4, 16, 'Forward']]) {
      const press = await samplePressFeedback(page, button, buttons)
      assert.ok(press.idle.width >= 9 && press.idle.width <= 11 && press.idle.outerPixels === 0, `An idle pointer has only the square marker (observed ${JSON.stringify(press.idle)})`)
      assert.ok(press.growth.some(sample => sample.width > press.idle.width + 2 && sample.width < press.held.width - 2), 'Pressing grows an outline through intermediate sizes')
      assert.ok(press.held.width >= 19 && press.held.width <= 22 && press.held.height >= 19 && press.held.height <= 22 && press.held.outerPixels > 0, 'The held outline expands to about 20 CSS pixels around the ten-pixel square')
      assert.deepEqual(press.stillHeld, press.held, 'The expanded outline stays visible and still while the button remains down')
      assert.ok(press.released.width >= 9 && press.released.width <= 11 && press.released.outerPixels === 0, 'Releasing immediately removes the outline and retains the square')
      pass(`${label}-button presses grow and hold an outline; releasing removes it while keeping the marker`)
    }
    const chord = await samplePressFeedback(page, 1, 4, true)
    assert.deepEqual(chord.partlyReleased, chord.held, 'Releasing middle while a side button remains held preserves the outline')
    assert.equal(chord.released.outerPixels, 0, 'Releasing the last side button clears the outline')
    pass('Chorded buttons keep feedback until the final mouse button is released')

    await activateTrail(page)
    await page.waitForFunction(selector => {
      const canvas = document.querySelector(selector)
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      const head = window.__learningPointerHead
      const scaleX = canvas.width / innerWidth
      const scaleY = canvas.height / innerHeight
      let count = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (!pixels[index]) continue
        const pixel = (index - 3) / 4
        if (Math.abs((pixel % canvas.width) / scaleX - head.x) > 6
          || Math.abs(Math.floor(pixel / canvas.width) / scaleY - head.y) > 6) return false
        count++
      }
      return count > 0
    }, trailSelector)
    assert.equal(await trail.getAttribute('data-active'), 'true', 'The settled square remains visible without requiring continuous pointer movement')
    pass('Native pointer movement settles to the square with no remaining trail pixels')

    for (const [selector, label] of [
      ['.learning-cover-image', 'The opening cover'],
      ['.nav-shell', 'The site navigation'],
      ['.footer-shell', 'The site footer'],
      ['.live2d-launcher', 'The companion launcher'],
    ]) {
      await activateTrail(page)
      await page.locator(selector).first().hover()
      await assertCleared(page, label)
      await page.locator(selector).first().evaluate(element => {
        const box = element.getBoundingClientRect()
        document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', button: 0, buttons: 1, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, bubbles: true }))
      })
      await assertCleared(page, `${label} during a left-button press`)
      await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', button: 0, bubbles: true })))
    }
    pass('The opening cover, navigation, footer, and companion controls suppress the marker and tail')

    await activateTrail(page)
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox', { name: '搜索站内内容' }).waitFor()
    await assertCleared(page, 'Opening search without moving the pointer')
    await page.getByRole('combobox', { name: '搜索站内内容' }).hover()
    await assertCleared(page, 'The search overlay')
    await page.keyboard.press('Escape')
    await activateTrail(page, '#notes .notes-gallery-heading h2')
    await page.locator('.note-cover').first().click()
    await page.locator('dialog[open]').waitFor()
    await assertCleared(page, 'Opening a note reader')
    await page.locator('.note-reader-paper').hover()
    await assertCleared(page, 'The note reader contents')
    await page.getByRole('button', { name: '关闭笔记' }).click()
    await page.locator('dialog[open]').waitFor({ state: 'hidden' })
    pass('Search and note-reader dialogs clear the existing trail and keep their contents free of pointer effects')

    await activateTrail(page)
    const scrolling = await page.evaluate(async () => {
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
      const canvas = document.querySelector('canvas.learning-pointer-trail')
      const origin = { ...window.__learningPointerHead }
      const move = x => document.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: x, clientY: origin.y }))
      const startY = scrollY
      move(origin.x + 100)
      await nextFrame()
      const beforeScroll = { ...window.__learningPointerHead }
      scrollBy({ top: 30, behavior: 'instant' })
      await nextFrame()
      await nextFrame()
      const stationary = { active: canvas.dataset.active, head: { ...window.__learningPointerHead }, segments: window.__learningPointerStrokeWidths.length }
      const moving = []
      for (let frame = 0; frame < 8; frame++) {
        move(origin.x + (frame % 2 ? 160 : 40))
        scrollBy({ top: 4, behavior: 'instant' })
        await nextFrame()
        moving.push({ active: canvas.dataset.active, segments: window.__learningPointerStrokeWidths.length })
      }
      const stopped = await nextFrame()
      while ((await nextFrame()) - stopped < 420) { /* Let the tail fade after scrolling stops. */ }
      const settledDraws = window.__learningPointerDraws
      for (let frame = 0; frame < 6; frame++) await nextFrame()
      return { startY, endY: scrollY, beforeScroll, stationary, moving, idleDraws: window.__learningPointerDraws - settledDraws }
    })
    assert.ok(scrolling.endY > scrolling.startY, 'The regression check scrolls the actual document')
    assert.equal(scrolling.stationary.active, 'true', 'Scrolling with a stationary pointer keeps the marker visible')
    assert.deepEqual(scrolling.stationary.head, scrolling.beforeScroll, 'Scrolling keeps the marker at the same viewport coordinates')
    assert.ok(scrolling.stationary.segments > 0, 'Scrolling preserves the existing fading trail')
    assert.ok(scrolling.moving.every(sample => sample.active === 'true' && sample.segments > 0), 'Pointer movement continues drawing a tail throughout scrolling')
    assert.equal(scrolling.idleDraws, 0, 'Scrolling adds no ongoing rendering once the trail settles')
    pass('Actual scrolling retains the stationary marker and moving trail, then stops rendering when idle')

    await page.locator('.learning-cover-image').scrollIntoViewIfNeeded()
    await waitForPointerLayout(page)
    const boundary = await page.evaluate(() => {
      const cover = document.querySelector('.learning-cover-image').getBoundingClientRect()
      return { x: cover.left + cover.width / 2, y: Math.max(cover.top + 30, document.querySelector('.nav-shell').getBoundingClientRect().bottom + 40), bottom: cover.bottom }
    })
    await page.mouse.move(boundary.x, boundary.y)
    await assertCleared(page, 'A stationary pointer over the cover')
    const coverScroll = await page.evaluate(() => scrollY)
    await page.evaluate(amount => scrollBy({ top: amount, behavior: 'instant' }), boundary.bottom - boundary.y + 40)
    await waitForPointerLayout(page)
    assert.equal(await trail.getAttribute('data-active'), 'true', 'Scrolling the cover away restores the stationary pointer without a new mouse event')
    await assertCoverMasked(page, 'The cover after scrolling beneath the stationary pointer')
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), coverScroll)
    await assertCleared(page, 'Scrolling the cover back beneath the stationary pointer')
    pass('Scrolling across the cover boundary updates masking and restores the stationary marker in allowed content')

    await activateTrail(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await assertCleared(page, 'Resizing')
    assert.ok(await trail.evaluate(canvas => canvas.width > 0 && canvas.height > 0 && Math.abs(canvas.width / canvas.height - innerWidth / innerHeight) < 0.01))
    await activateTrail(page)
    await page.mouse.down()
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await assertCleared(page, 'Window blur')
    await page.mouse.up()
    await activateTrail(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await assertCleared(page, 'Enabling reduced motion')
    assert.equal(await trail.evaluate(canvas => getComputedStyle(canvas).display), 'none')
    await page.locator('#skills .learning-panel-diagram').first().hover()
    await assertCleared(page, 'Reduced-motion pointer movement')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await activateTrail(page)
    pass('Resize and blur clear stale pixels; reduced motion disables the effect and toggles back cleanly')

    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      await activateTrail(page)
    }
    await page.locator('.nav-link').filter({ hasText: '关于' }).click()
    await page.waitForFunction(() => document.body.dataset.page === 'about')
    assert.equal(await page.locator(trailSelector).count(), 0, 'The canvas unmounts when navigating away from Learning')
    await page.mouse.move(400, 300)
    await page.locator('.nav-link').filter({ hasText: '学习' }).click()
    await page.waitForFunction(() => document.body.dataset.page === 'learning')
    assert.equal(await page.locator(trailSelector).count(), 1, 'Returning to Learning mounts exactly one fresh trail')
    await activateTrail(page)
    assert.deepEqual(errors, [])
    pass('Both themes support the trail, and client navigation removes and remounts a single effect without browser errors')
  } finally {
    await context.close()
  }

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const touch = await touchContext.newPage()
  try {
    await touch.goto(url)
    await touch.locator('#skills .learning-panel-diagram').first().tap()
    await assertCleared(touch, 'Touch input')
    assert.equal(await touch.locator(trailSelector).evaluate(canvas => getComputedStyle(canvas).display), 'none')
    assert.ok(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    pass('Touch screens retain normal interactions without showing a pointer trail or adding horizontal overflow')
  } finally {
    await touchContext.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runLearningPointerChecks(browser, process.env.LEARNING_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} learning pointer checks passed`)
  } catch (error) {
    console.error('Learning pointer browser checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
