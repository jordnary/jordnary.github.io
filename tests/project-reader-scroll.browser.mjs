import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runProjectReaderScrollChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const checks = [], failures = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  const check = async (name, action) => {
    try { await action(); checks.push(name); report(name) }
    catch (error) { failures.push(`${name}: ${error.message}`) }
  }
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 2, `${message}: expected ${expected}, got ${actual}`)
  const frames = (count = 4) => page.evaluate(total => new Promise(resolve => {
    const tick = () => --total <= 0 ? resolve() : requestAnimationFrame(tick)
    requestAnimationFrame(tick)
  }), count)
  const state = () => page.evaluate(() => {
    const body = document.querySelector('.project-reader-scroll')
    return { page: scrollY, body: body.scrollTop, bodyMax: body.scrollHeight - body.clientHeight,
      pageMax: document.documentElement.scrollHeight - innerHeight }
  })
  const open = async (chapter = 'sampling') => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(new URL(`projects/triton-attention-optimization/#project-${chapter}`, baseURL).href)
    await page.waitForFunction(id => document.querySelector('.project-reader-layout')?.dataset.chapter === id
      && document.querySelector('.project-reader-layout')?.dataset.phase === 'idle', chapter)
    await page.locator('.project-reader-scroll').evaluate(element => element.style.removeProperty('zoom'))
    await page.evaluate(() => document.fonts.ready)
    await page.locator('.project-introduction img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
    await frames()
  }
  const position = async (bodyOffset, frameTop = 240) => {
    await page.evaluate(({ offset, top }) => {
      const body = document.querySelector('.project-reader-scroll')
      body.scrollTop = offset < 0 ? body.scrollHeight - body.clientHeight + offset : offset
      window.scrollBy({ top: document.querySelector('.project-reader-layout').getBoundingClientRect().top - top, behavior: 'instant' })
    }, { offset: bodyOffset, top: frameTop })
    await frames()
    return page.locator('.project-reader-scroll').boundingBox()
  }
  const wheel = async delta => { await page.mouse.wheel(0, delta); await frames() }
  const burst = async (delta, count) => {
    for (let index = 0; index < count; index++) await page.mouse.wheel(0, delta)
    await frames(8)
  }
  const ownsPoint = point => page.evaluate(({ x, y }) =>
    Boolean(document.elementFromPoint(x, y)?.closest('.project-reader-scroll')), point)
  const withMotionPage = async (action, {
    project = 'triton-attention-optimization', chapter = 'sampling',
    viewport = { width: 1440, height: 1000 }, fromPageTop = false,
  } = {}) => {
    const motionContext = await browser.newContext({ viewport, reducedMotion: 'no-preference' })
    try {
      const motionPage = await motionContext.newPage()
      motionPage.on('pageerror', error => errors.push(error.message))
      await motionPage.goto(new URL(`projects/${project}/#project-${chapter}`, baseURL).href)
      await motionPage.waitForFunction(id => document.querySelector('.project-reader-layout')?.dataset.chapter === id
        && document.querySelector('.project-reader-layout')?.dataset.phase === 'idle', chapter)
      await motionPage.evaluate(() => document.fonts.ready)
      await motionPage.locator('.project-introduction img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
      await motionPage.evaluate(alignReader => {
        document.querySelector('.project-reader-scroll').scrollTop = 60
        if (alignReader) window.scrollBy({ top: document.querySelector('.project-reader-layout').getBoundingClientRect().top - 240, behavior: 'instant' })
        else {
          document.querySelector('.project-reader-scroll').scrollTop = 0
          window.scrollTo({ top: 0, behavior: 'instant' })
        }
      }, !fromPageTop)
      await action(motionPage)
    } finally { await motionContext.close() }
  }
  const observeScroll = async (motionPage, input) => {
    await motionPage.evaluate(() => {
      const body = document.querySelector('.project-reader-scroll')
      const position = () => ({ page: scrollY, body: body.scrollTop, bodyMax: body.scrollHeight - body.clientHeight })
      const probe = { initial: position(), frames: [], events: [], done: false }
      const listener = event => probe.events.push({
        canceled: event.defaultPrevented, cancelable: event.cancelable, delta: event.deltaY,
        frame: probe.frames.length, ...position(),
      })
      document.addEventListener('wheel', listener)
      probe.cleanup = () => { probe.done = true; document.removeEventListener('wheel', listener) }
      window.__readerWheelProbe = probe
      const sample = () => {
        if (probe.done) return
        probe.frames.push(position())
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    try {
      await input()
      await motionPage.waitForFunction(() => {
        const probe = window.__readerWheelProbe
        const tail = probe.frames.slice(-8)
        return probe.events.length > 0 && tail.length === 8
          && tail.every(frame => frame.page === tail[0].page && frame.body === tail[0].body)
          && (tail[0].page !== probe.initial.page || tail[0].body !== probe.initial.body)
      }, undefined, { timeout: 5000 })
      return await motionPage.evaluate(() => {
        const probe = window.__readerWheelProbe
        return { initial: probe.initial, frames: probe.frames, events: probe.events, final: probe.frames.at(-1) }
      })
    } finally { await motionPage.evaluate(() => { window.__readerWheelProbe.cleanup(); delete window.__readerWheelProbe }) }
  }
  const observeWheels = (motionPage, delta, count = 1) => observeScroll(motionPage, async () => {
    for (let index = 0; index < count; index++) await motionPage.mouse.wheel(0, delta)
  })
  const observeGesture = async (motionPage, point, delta, reverseDistance = 0) => {
    const session = await motionPage.context().newCDPSession(motionPage)
    try {
      // Exercise one uninterrupted platform gesture, including target changes;
      // separate mouse.wheel calls do not cover browser scroll latching.
      return await observeScroll(motionPage, () => session.send('Input.synthesizeScrollGesture', {
        ...point, yDistance: -delta, speed: 800, gestureSourceType: 'mouse',
        ...(reverseDistance ? { yOverscroll: -Math.sign(delta) * reverseDistance } : {}),
      }))
    } finally { await session.detach() }
  }
  const hasIntermediateFrame = (probe, target) => {
    const start = probe.initial[target], end = probe.final[target]
    return probe.frames.some(frame => frame[target] > Math.min(start, end) && frame[target] < Math.max(start, end))
  }
  const assertTinyOverflowDistance = (probe, expected) => {
    const traveled = Math.abs(probe.final.page - probe.initial.page) + Math.abs(probe.final.body - probe.initial.body)
    near(traveled, expected, 'Continuous input is consumed once across the tiny boundary')
  }
  try {
    await check('VAE implementation at page top hands a continuous gesture past one-pixel body overflow to the page', async () => {
      for (const viewport of [{ width: 1440, height: 969 }, { width: 1704, height: 990 }]) {
        await withMotionPage(async motionPage => {
          const box = await motionPage.locator('.project-reader-scroll').boundingBox()
          const point = { x: box.x + box.width / 2, y: box.y + 30 }
          assert.ok(point.y < viewport.height, 'The pointer uses the body already visible at page top')
          await motionPage.mouse.move(point.x, point.y)
          const probe = await observeGesture(motionPage, point, 260)
          assert.equal(probe.initial.page, 0, 'The entire page starts at the top without centering the reader')
          assert.equal(probe.initial.body, 0, 'The body starts at its top')
          assert.equal(probe.initial.bodyMax, 1, 'The real VAE layout has one pixel of inner overflow')
          assert.equal(probe.final.body, 1, 'The body consumes its actual overflow')
          assertTinyOverflowDistance(probe, 260)
          const edgeEvents = probe.events.filter(event => event.body >= 1)
          assert.ok(edgeEvents.length >= 5, 'Input continues across the boundary in the original gesture')
          const firstMovement = probe.frames.findIndex(frame => frame.page > 0)
          assert.ok(firstMovement >= 0 && firstMovement <= edgeEvents[0].frame + 2,
            'Page movement begins within two frames of reaching the body boundary')
          assert.ok(edgeEvents.slice(1, -1).some(event => event.page > 20), 'The page moves before the gesture ends')
          assert.ok(hasIntermediateFrame(probe, 'page'), 'The handoff retains smooth intermediate positions')
        }, { project: 'vae-digits', chapter: 'implementation', viewport, fromPageTop: true })
      }
    })
    await check('One-pixel and fractional body overflow hand upward continuation to the page without a gesture pause', async () => {
      await withMotionPage(async motionPage => {
        for (const zoom of [1, 1.25]) {
          const before = await motionPage.evaluate(zoom => {
            const body = document.querySelector('.project-reader-scroll')
            if (zoom !== 1) {
              body.style.zoom = String(zoom)
              body.style.height = `${body.firstElementChild.getBoundingClientRect().height / zoom - 0.5}px`
            }
            body.scrollTop = body.scrollHeight
            window.scrollTo({ top: 400, behavior: 'instant' })
            const rect = body.getBoundingClientRect()
            return { body: body.scrollTop, maximum: body.scrollHeight - body.clientHeight,
              point: { x: rect.x + rect.width / 2, y: rect.y + 30 } }
          }, zoom)
          assert.ok(before.body > 0 && before.body <= 1, 'The body has a real tiny scrolling range')
          assert.equal(before.maximum, zoom === 1 ? 1 : 0, 'Zoom also exercises overflow hidden by rounded dimensions')
          await motionPage.mouse.move(before.point.x, before.point.y)
          const probe = await observeGesture(motionPage, before.point, -260)
          assert.equal(probe.final.body, 0, 'The body reaches its upper boundary')
          assertTinyOverflowDistance(probe, 260)
          const firstEdge = probe.events.find(event => event.body === 0)
          const firstMovement = probe.frames.findIndex(frame => frame.page < probe.initial.page)
          assert.ok(firstEdge && firstMovement >= 0 && firstMovement <= firstEdge.frame + 2,
            'Upward handoff begins within two frames of reaching the boundary')
          assert.ok(probe.events.slice(1, -1).some(event => event.page < 380), 'Movement continues during the original gesture')
        }
      }, { project: 'vae-digits', chapter: 'implementation', viewport: { width: 1704, height: 990 }, fromPageTop: true })
    })
    await check('Adjacent VAE layouts and fractional overflow retain continuous downward scrolling', async () => {
      for (const height of [989, 991, 992]) {
        await withMotionPage(async motionPage => {
          const box = await motionPage.locator('.project-reader-scroll').boundingBox()
          const point = { x: box.x + box.width / 2, y: box.y + 30 }
          await motionPage.mouse.move(point.x, point.y)
          const probe = await observeGesture(motionPage, point, 260)
          assertTinyOverflowDistance(probe, 260)
          if (probe.final.body === 0) near(probe.final.page, 260, 'Non-overflowing chapters pass the complete distance to the page')
        }, { project: 'vae-digits', chapter: 'implementation', viewport: { width: 1704, height }, fromPageTop: true })
      }
      await withMotionPage(async motionPage => {
        const point = await motionPage.evaluate(() => {
          const body = document.querySelector('.project-reader-scroll')
          body.style.zoom = '1.25'
          body.style.height = `${body.firstElementChild.getBoundingClientRect().height / 1.25 - 0.5}px`
          const rect = body.getBoundingClientRect()
          return { x: rect.x + rect.width / 2, y: rect.y + 30 }
        })
        await motionPage.mouse.move(point.x, point.y)
        const probe = await observeGesture(motionPage, point, 260)
        assert.equal(probe.initial.bodyMax, 0, 'Integer dimensions hide the fractional overflow')
        assert.ok(probe.final.body > 0 && probe.final.body < 1, 'The body consumes its real fractional range')
        assertTinyOverflowDistance(probe, 260)
        assert.ok(probe.events.slice(1, -1).some(event => event.page > 20), 'Page movement starts during the original gesture')
      }, { project: 'vae-digits', chapter: 'implementation', viewport: { width: 1704, height: 990 }, fromPageTop: true })
    })
    await check('Continued downward input at the body boundary scrolls the page and reversal resumes the body', async () => {
      await open()
      const box = await position(-20)
      await page.mouse.move(box.x + box.width / 2, box.y + 35)
      const before = await state()
      assert.ok(before.pageMax - before.page > 240, 'The page has downward scrolling headroom')
      await wheel(60)
      let after = await state()
      near(after.body, before.bodyMax, 'The body consumes its final 20px')
      const boundaryPage = after.page
      await burst(20, 8)
      after = await state()
      near(after.page, boundaryPage + 160, 'Every continued downward wheel at the boundary moves the page')
      await wheel(-40)
      after = await state()
      near(after.page, boundaryPage + 160, 'Reversing over the body leaves the page still')
      near(after.body, before.bodyMax - 40, 'Reversal immediately resumes body scrolling without moving the pointer')
    })
    await check('Continued upward input at the body boundary scrolls the page as the reader leaves the pointer', async () => {
      await open()
      const box = await position(20, 180)
      const point = { x: box.x + box.width / 2, y: box.y + 15 }
      await page.mouse.move(point.x, point.y)
      await wheel(-60)
      near((await state()).body, 0, 'The crossing wheel reaches the top of the body')
      const boundaryPage = (await state()).page
      await burst(-20, 8)
      let after = await state()
      near(after.body, 0, 'The body stays at its upper boundary')
      near(after.page, boundaryPage - 160, 'The page consumes the complete continued upward stream')
      assert.equal(await ownsPoint(point), false, 'Scrolling moved the reader away from the stationary pointer')
      await wheel(40)
      after = await state()
      near(after.page, boundaryPage - 120, 'Reversing outside the body scrolls the page')
      near(after.body, 0, 'The body stays still while it is outside the pointer')
    })
    await check('A stationary pointer switches immediately when page movement brings the body beneath it', async () => {
      await open()
      const box = await position(60)
      const point = { x: box.x + box.width / 2, y: box.y - 30 }
      await page.mouse.move(point.x, point.y)
      assert.equal(await ownsPoint(point), false)
      const before = await state()
      await wheel(80)
      assert.equal(await ownsPoint(point), true, 'Page movement brought the reader beneath the unchanged pointer')
      const crossing = await state()
      const pageDistance = crossing.page - before.page
      assert.ok(pageDistance > 0 && pageDistance < 80, 'Page motion stops as soon as the body enters the pointer')
      near(crossing.body, before.body + 80 - pageDistance, 'The same input continues in the newly hovered body')
      await wheel(60)
      let after = await state()
      near(after.page, crossing.page, 'Further input leaves the page still after the body moves beneath the pointer')
      near(after.body, crossing.body + 60, 'The currently hovered body receives further input without a pointer move')
      await wheel(-20)
      after = await state()
      near(after.page, crossing.page, 'Reversing over the body leaves the page still')
      near(after.body, crossing.body + 40, 'The reversed wheel scrolls the currently hovered body')
    })
    await check('Moving the pointer between body and page selects the currently hovered scroll region', async () => {
      await open()
      const box = await position(60)
      const point = { x: box.x + box.width / 2, y: box.y + 80 }
      await page.mouse.move(point.x, point.y)
      const before = await state()
      await wheel(20)
      await page.mouse.move(20, point.y)
      await wheel(30)
      let after = await state()
      near(after.body, before.body + 20, 'Moving into the page immediately releases the body')
      near(after.page, before.page + 30, 'The page receives the next wheel')
      await page.mouse.move(point.x, point.y)
      await wheel(20)
      after = await state()
      near(after.page, before.page + 30, 'Moving back into the body immediately releases the page')
      near(after.body, before.body + 40, 'The body receives the next wheel within the same input sequence')
    })
    await check('Fractional wheel deltas accumulate during native body scrolling and boundary handoff', async () => {
      await open()
      let box = await position(60)
      await page.mouse.move(box.x + box.width / 2, box.y + 50)
      const interior = await state()
      for (let index = 0; index < 20; index++) {
        await page.mouse.move(box.x + box.width / 2 + index + 1, box.y + 50)
        await page.mouse.wheel(0, 0.25)
      }
      await frames(8)
      assert.equal((await state()).body, interior.body + 5, 'Twenty subpixel wheels accumulate into five pixels despite small pointer moves within the body')
      assert.equal((await state()).page, interior.page, 'Subpixel body scrolling leaves the page still')
      box = await position(0)
      await page.locator('.project-reader-scroll').evaluate(element => { element.scrollTop = element.scrollHeight })
      await page.mouse.move(box.x + box.width / 2 + 1, box.y + 50)
      const before = await state()
      await burst(0.25, 16)
      let after = await state()
      assert.equal(after.body, before.bodyMax, 'The body stays at its boundary')
      assert.equal(after.page, before.page + 4, 'Subpixel wheels at the boundary accumulate into page movement')
      await burst(-0.25, 16)
      after = await state()
      assert.equal(after.page, before.page + 4, 'Reversing over the body leaves the page still')
      assert.equal(after.body, before.bodyMax - 4, 'Fractional reversal resumes the currently hovered body')
    })
    await check('Continued input after a fractional body boundary reaches the page and reversal restores the body', async () => {
      await open()
      await page.locator('.project-reader-scroll').evaluate(element => { element.style.zoom = '2' })
      const box = await position(0.5)
      await page.mouse.move(box.x + 50, box.y + 20)
      const before = await state()
      assert.equal(before.body, 0.5, 'CSS zoom provides a real fractional body position')
      await wheel(-1)
      const crossing = await state()
      assert.equal(crossing.body, 0, 'The crossing wheel consumes the remaining half body pixel')
      await wheel(-10)
      const boundaryPage = (await state()).page
      near(boundaryPage, crossing.page - 10, 'The next outward wheel moves the page at the fractional boundary')
      await page.waitForTimeout(350)
      await wheel(10)
      const after = await state()
      near(after.page, boundaryPage, 'Reversing over the body stops scrolling the page')
      assert.ok(after.body > 0, 'The reversed wheel resumes native body scrolling')
    })
    await check('A chapter without inner overflow passes continuous wheels and reversals to the page', async () => {
      await open('scope')
      const box = await position(0)
      await page.mouse.move(box.x + box.width / 2, box.y + 50)
      const before = await state()
      assert.equal(before.bodyMax, 0, 'This chapter has no internal scrolling range')
      await burst(20, 6)
      near((await state()).page, before.page + 120, 'All downward wheels pass through the short chapter')
      await burst(-20, 6)
      const after = await state()
      near(after.page, before.page, 'All upward wheels pass through the short chapter')
      near(after.body, 0, 'Short chapter content remains at its origin')
    })
    await check('Contents retain their own wheel scrolling and closing restores page scrolling', async () => {
      await open()
      await page.setViewportSize({ width: 1440, height: 420 })
      await page.getByRole('button', { name: '本页目录', exact: true }).click()
      await page.locator('dialog.project-reader-toc').waitFor({ state: 'visible' })
      const nav = page.locator('#project-toc-links')
      const box = await nav.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      const before = await state()
      await wheel(80)
      assert.ok(await nav.evaluate(element => element.scrollTop > 10), 'The actual contents list receives the wheel')
      assert.deepEqual(await state(), before, 'Contents scrolling leaves both background scroll positions unchanged')
      await page.keyboard.press('Escape')
      await page.locator('dialog.project-reader-toc').waitFor({ state: 'hidden' })
      await page.mouse.move(20, 200)
      await wheel(-40)
      near((await state()).page, before.page - 40, 'Page scrolling resumes after the contents close')
    })
    await check('Gallery wheels still zoom images and closing restores reader scrolling', async () => {
      await open()
      await position(0)
      await page.locator('.project-introduction-image button').first().click()
      await page.locator('.yarl__slide_current img').waitFor()
      const stage = await page.locator('.gallery-stage').boundingBox()
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2)
      const before = await state()
      await wheel(-180)
      await page.waitForFunction(() => parseInt(document.querySelector('.gallery-zoom-reset').textContent) > 100)
      assert.deepEqual(await state(), before, 'Gallery zoom does not move either background scroll position')
      await page.keyboard.press('Escape')
      await page.locator('.gallery-stage').waitFor({ state: 'hidden' })
      const box = await position(40)
      await page.mouse.move(box.x + box.width / 2, box.y + 50)
      const restored = await state()
      await wheel(30)
      const after = await state()
      near(after.body, restored.body + 30, 'Body scrolling resumes after the gallery closes')
      near(after.page, restored.page, 'Restored body scrolling leaves the page still')
    })
    await check('Ordinary page and body wheels stay smooth and consume their distance exactly once', async () => {
      await withMotionPage(async motionPage => {
        await motionPage.mouse.move(20, 300)
        const pageProbe = await observeWheels(motionPage, 120)
        assert.ok(hasIntermediateFrame(pageProbe, 'page'), 'Page scrolling renders smooth intermediate positions')
        near(pageProbe.final.page, pageProbe.initial.page + 120, 'The page receives the full wheel distance')
        near(pageProbe.final.body, pageProbe.initial.body, 'Page scrolling leaves body position unchanged')

        const box = await motionPage.locator('.project-reader-scroll').boundingBox()
        await motionPage.mouse.move(box.x + box.width / 2, box.y + 80)
        const bodyProbe = await observeWheels(motionPage, 120)
        assert.ok(hasIntermediateFrame(bodyProbe, 'body'), 'Body scrolling renders smooth intermediate positions')
        near(bodyProbe.final.body, bodyProbe.initial.body + 120, 'The body receives the full wheel distance')
        near(bodyProbe.final.page, bodyProbe.initial.page, 'Body scrolling leaves page position unchanged')
      })
    })
    await check('Continuous gestures retain their full distance without native target locking or duplicate scrolling', async () => {
      await withMotionPage(async motionPage => {
        const pagePoint = { x: 20, y: 300 }
        await motionPage.mouse.move(pagePoint.x, pagePoint.y)
        const pageProbe = await observeGesture(motionPage, pagePoint, 120)
        assert.ok(pageProbe.events.length >= 5, 'The page gesture includes continuous input')
        assert.ok(pageProbe.events.every(event => event.cancelable && event.canceled), 'The page gesture remains available for region switching')
        near(pageProbe.final.page, pageProbe.initial.page + 120, 'Page input is consumed exactly once')
        near(pageProbe.final.body, pageProbe.initial.body, 'The page gesture leaves the body still')

        const box = await motionPage.locator('.project-reader-scroll').boundingBox()
        const bodyPoint = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        await motionPage.mouse.move(bodyPoint.x, bodyPoint.y)
        const bodyProbe = await observeGesture(motionPage, bodyPoint, 120)
        assert.ok(bodyProbe.events.length >= 5, 'The body gesture includes continuous input')
        assert.ok(bodyProbe.events.every(event => event.cancelable && event.canceled), 'The body gesture remains available for region switching')
        near(bodyProbe.final.body, bodyProbe.initial.body + 120, 'Body input is consumed exactly once')
        near(bodyProbe.final.page, bodyProbe.initial.page, 'The body gesture leaves the page still')
      })
    })
    await check('A continuous gesture from inside the body hands off within two frames at either boundary', async () => {
      await withMotionPage(async motionPage => {
        for (const direction of [-1, 1]) {
          await motionPage.evaluate(direction => {
            const body = document.querySelector('.project-reader-scroll')
            body.scrollTop = direction < 0 ? 60 : body.scrollHeight - body.clientHeight - 60
            window.scrollBy({ top: document.querySelector('.project-reader-layout').getBoundingClientRect().top - 240, behavior: 'instant' })
          }, direction)
          const box = await motionPage.locator('.project-reader-scroll').boundingBox()
          const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
          await motionPage.mouse.move(point.x, point.y)
          const probe = await observeGesture(motionPage, point, direction * 260)
          const atEdge = sample => direction < 0 ? sample.body <= 0 : sample.body >= sample.bodyMax - 1
          const outwardEvents = probe.events.filter(atEdge)
          assert.ok(outwardEvents.length >= 5, 'The gesture continues across the visible boundary without a pause')
          assert.ok(probe.events.every(event => event.cancelable && event.canceled), 'The same gesture stays available for immediate boundary handoff')
          const firstMovement = probe.frames.findIndex(frame => direction * (frame.page - probe.initial.page) > 0)
          assert.ok(firstMovement >= 0, 'The page starts moving while continuous input reaches the body boundary')
          assert.ok(firstMovement <= outwardEvents[0].frame + 2,
            `Page handoff begins within two frames of the first outward input: event frame ${outwardEvents[0].frame}, movement frame ${firstMovement}`)
          assert.ok(outwardEvents.slice(1, -1).some(event => direction * (event.page - probe.initial.page) > 20),
            'The page makes sustained progress before the gesture ends')
          const distance = direction * (probe.final.page - probe.initial.page)
          assert.ok(distance >= 180 && distance <= 220,
            `The continued gesture reaches the page once without losing input: expected about 200px, got ${distance}px`)
          assert.ok(atEdge(probe.final), 'The body remains at its reached boundary')
          assert.ok(hasIntermediateFrame(probe, 'page'), 'The page handoff renders intermediate positions')
          const frameSteps = probe.frames.slice(1).map((frame, index) => direction * (frame.page - probe.frames[index].page))
          assert.ok(frameSteps.every(step => step >= 0), 'The handoff advances without backward jumps')
        }
      })
    })
    await check('Reversing a continuous gesture immediately returns scrolling to the hovered body', async () => {
      await withMotionPage(async motionPage => {
        for (const direction of [-1, 1]) {
          await motionPage.evaluate(direction => {
            const body = document.querySelector('.project-reader-scroll')
            body.scrollTop = direction < 0 ? 60 : body.scrollHeight - body.clientHeight - 60
            window.scrollBy({ top: document.querySelector('.project-reader-layout').getBoundingClientRect().top - 240, behavior: 'instant' })
          }, direction)
          const box = await motionPage.locator('.project-reader-scroll').boundingBox()
          const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
          await motionPage.mouse.move(point.x, point.y)
          const probe = await observeGesture(motionPage, point, direction * 240, 120)
          const reversalEvents = probe.events.filter(event => event.delta * direction < 0)
          assert.ok(reversalEvents.length >= 5, 'The same gesture reverses while the pointer stays over the body')
          assert.ok(reversalEvents.every(event => event.cancelable && event.canceled), 'Reversed input remains available for immediate region switching')
          const reversal = reversalEvents[0]
          assert.ok(direction * (reversal.page - probe.initial.page) > 40, 'The page has moved before reversal')
          const distanceFromEdge = sample => direction < 0 ? sample.body : sample.bodyMax - sample.body
          const resumed = probe.frames.findIndex((frame, index) => index >= reversal.frame && distanceFromEdge(frame) > 0)
          assert.ok(resumed >= 0 && resumed <= reversal.frame + 2, 'The body resumes within two frames of reversed input')
          assert.ok(probe.frames.slice(reversal.frame).every(frame => Math.abs(frame.page - reversal.page) <= 1),
            'Reversal stops pending page motion without a delayed tail or backward correction')
          const bodyDistance = distanceFromEdge(probe.final)
          assert.ok(bodyDistance >= 110 && bodyDistance <= 130,
            `Reversed input is consumed by the body once: expected about 120px, got ${bodyDistance}px`)
        }
      })
    })
    await check('Boundary handoff stays smooth and makes progress throughout continued input in both directions', async () => {
      await withMotionPage(async motionPage => {
        for (const direction of [1, -1]) {
          await motionPage.evaluate(direction => {
            const body = document.querySelector('.project-reader-scroll')
            body.scrollTop = direction > 0 ? body.scrollHeight : 0
            window.scrollBy({ top: document.querySelector('.project-reader-layout').getBoundingClientRect().top - 240, behavior: 'instant' })
          }, direction)
          const box = await motionPage.locator('.project-reader-scroll').boundingBox()
          await motionPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          const probe = await observeWheels(motionPage, direction * 20, 10)
          near(probe.final.page, probe.initial.page + direction * 200, 'The page consumes all continued outward input')
          near(probe.final.body, probe.initial.body, 'The body stays at its boundary')
          assert.ok(hasIntermediateFrame(probe, 'page'), 'Boundary handoff renders intermediate page positions')
          assert.ok(probe.events.slice(1, -1).some(event => direction * (event.page - probe.initial.page) > 0),
            'Page movement starts before the wheel stream ends')
          const frameSteps = probe.frames.slice(1).map((frame, index) => direction * (frame.page - probe.frames[index].page))
          assert.ok(frameSteps.every(step => step >= 0), 'Boundary animation advances without backward jumps')
        }
      })
    })
    assert.deepEqual(errors, [], 'No uncaught browser errors')
    assert.deepEqual(failures, [], 'Reader wheel regression failures')
    return checks
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true, args: ['--enable-smooth-scrolling'] }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true, args: ['--enable-smooth-scrolling'] })
  try {
    const checks = await runProjectReaderScrollChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:4173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} project reader scroll checks passed`)
  } catch (error) {
    console.error('Project reader scroll checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
