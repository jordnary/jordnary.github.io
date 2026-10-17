import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runProjectReaderHoverChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const checks = [], failures = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  const check = async (name, action) => {
    try { await action(); checks.push(name); report(name) }
    catch (error) { failures.push(`${name}: ${error.message}`) }
  }
  const frames = (count = 3) => page.evaluate(total => new Promise(resolve => {
    const tick = () => --total <= 0 ? resolve() : requestAnimationFrame(tick)
    requestAnimationFrame(tick)
  }), count)
  const open = async (bodyOffset = 0) => {
    await page.goto(new URL('projects/triton-attention-optimization/#project-sampling', baseURL).href)
    await page.waitForFunction(() => document.querySelector('.project-reader-layout')?.dataset.chapter === 'sampling'
      && document.querySelector('.project-reader-layout')?.dataset.phase === 'idle')
    await page.evaluate(() => document.fonts.ready)
    await page.locator('.project-introduction img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
    await page.evaluate(offset => {
      const body = document.querySelector('.project-reader-scroll')
      body.scrollTop = offset
      window.scrollBy({ top: body.getBoundingClientRect().top - 400, behavior: 'instant' })
    }, bodyOffset)
    await frames()
    return page.locator('.project-reader-scroll').boundingBox()
  }
  const beginProbe = point => page.evaluate(point => {
    const body = document.querySelector('.project-reader-scroll')
    const owner = element => Boolean(element?.closest('.project-reader-scroll'))
    const probe = { point, events: [], frames: [], marks: [], done: false }
    const position = () => ({ time: performance.now(), page: scrollY, body: body.scrollTop,
      hitBody: owner(document.elementFromPoint(probe.point.x, probe.point.y)) })
    const listener = event => probe.events.push({ ...position(), delta: event.deltaY,
      frame: probe.frames.length, targetBody: owner(event.target), cancelable: event.cancelable,
      clientX: event.clientX, clientY: event.clientY })
    probe.initial = position()
    probe.mark = name => probe.marks.push({ name, frame: probe.frames.length, ...position() })
    probe.cleanup = () => { probe.done = true; window.removeEventListener('wheel', listener) }
    window.__readerHoverProbe = probe
    window.addEventListener('wheel', listener)
    const sample = () => {
      if (probe.done) return
      probe.frames.push(position())
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, point)
  const mark = (name, point) => page.evaluate(({ name, point }) => {
    if (point) window.__readerHoverProbe.point = point
    window.__readerHoverProbe.mark(name)
  }, { name, point })
  const endProbe = async () => {
    await page.waitForFunction(() => {
      const probe = window.__readerHoverProbe
      const tail = probe.frames.slice(-10)
      return probe.events.length > 0 && tail.length === 10
        && tail.every(frame => frame.page === tail[0].page && frame.body === tail[0].body)
    }, undefined, { timeout: 5000 })
    return page.evaluate(() => {
      const probe = window.__readerHoverProbe
      probe.cleanup()
      const result = { initial: probe.initial, events: probe.events, frames: probe.frames,
        marks: probe.marks, final: probe.frames.at(-1) }
      delete window.__readerHoverProbe
      return result
    })
  }
  const gesture = async (point, distance, reverseDistance = 0) => {
    const session = await context.newCDPSession(page)
    try {
      await session.send('Input.synthesizeScrollGesture', { ...point, yDistance: -distance,
        speed: 800, gestureSourceType: 'mouse',
        ...(reverseDistance ? { yOverscroll: -Math.sign(distance) * reverseDistance } : {}) })
    } finally { await session.detach() }
  }
  const smoothMonotonic = (samples, property, direction = 1, maximumInput = 0) => {
    const values = samples.map(sample => sample[property])
    const minimum = Math.min(...values), maximum = Math.max(...values)
    if (maximum - minimum > maximumInput) {
      assert.ok(values.some(value => value > minimum && value < maximum), `${property} renders intermediate positions`)
    }
    for (let index = 1; index < samples.length; index++) {
      const distance = (values[index] - values[index - 1]) * direction
      assert.ok(distance >= -1, `${property} moves without backward corrections: ${distance}px`)
      const elapsed = samples[index].time - samples[index - 1].time
      assert.ok(Math.abs(distance) <= Math.max(32, maximumInput, elapsed * 1.6),
        `${property} has no large single-frame jump: ${distance}px in ${elapsed.toFixed(1)}ms`)
    }
  }
  try {
    await check('Page movement brings the body under a stationary pointer and switches within the same gesture', async () => {
      const box = await open()
      const point = { x: box.x + box.width / 2, y: box.y - 30 }
      await page.mouse.move(point.x, point.y)
      await beginProbe(point)
      // Leave enough inner scrolling room after the pointer crosses the top;
      // reaching the body's far boundary would correctly resume page scrolling.
      const bodyMaximum = await page.locator('.project-reader-scroll').evaluate(body => body.scrollHeight - body.clientHeight)
      assert.ok(bodyMaximum > 200, 'The body has enough room to isolate the entry handoff')
      await gesture(point, 200)
      const probe = await endProbe()
      assert.equal(probe.initial.hitBody, false, 'The gesture starts above the body')
      const entered = probe.frames.findIndex(frame => frame.hitBody)
      const bodyStarted = probe.frames.findIndex(frame => frame.body > 0)
      assert.ok(entered >= 0, 'Page scrolling brings the body under the stationary pointer')
      assert.ok(bodyStarted >= entered && bodyStarted <= entered + 2,
        `The body starts within two frames of entering it: entered=${entered}, moved=${bodyStarted}`)
      assert.ok(probe.events.some(event => event.hitBody && event.body > 40), 'The body moves before this gesture ends')
      assert.ok(probe.final.body > 140, `Continued input reaches the body: ${probe.final.body}px`)
      assert.ok(probe.final.page - probe.initial.page <= 55, 'The page stops after the pointer enters the body')
      const total = probe.final.page - probe.initial.page + probe.final.body
      assert.ok(total >= 185 && total <= 210, `Input is consumed once across the switch: ${total}px`)
      smoothMonotonic([probe.initial, ...probe.frames], 'page')
      smoothMonotonic([probe.initial, ...probe.frames], 'body')
    })
    await check('Upward page movement brings the body under a pointer below it and switches within the same gesture', async () => {
      await open(200)
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
      await frames()
      const box = await page.locator('.project-reader-scroll').boundingBox()
      const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height + 30) }
      assert.ok(point.y < 1000, 'The pointer below the body remains inside the viewport')
      await page.mouse.move(point.x, point.y)
      await beginProbe(point)
      await gesture(point, -200)
      const probe = await endProbe()
      assert.equal(probe.initial.hitBody, false, 'The upward gesture starts below the body')
      assert.equal(probe.initial.body, 200, 'The body has enough upward room to isolate the entry handoff')
      const entered = probe.frames.findIndex(frame => frame.hitBody)
      const bodyStarted = probe.frames.findIndex(frame => frame.body < probe.initial.body)
      assert.ok(entered >= 0, 'Upward page scrolling brings the body under the stationary pointer')
      assert.ok(bodyStarted >= entered && bodyStarted <= entered + 2,
        `The body starts within two frames of entering from below: entered=${entered}, moved=${bodyStarted}`)
      assert.ok(probe.events.some(event => event.hitBody && probe.initial.body - event.body > 40),
        'The body moves upward before the same gesture ends')
      assert.ok(probe.initial.body - probe.final.body > 140, 'Continued upward input reaches the body')
      assert.ok(probe.initial.page - probe.final.page <= 55, 'The page stops after entry from below')
      const total = probe.initial.page - probe.final.page + probe.initial.body - probe.final.body
      assert.ok(total >= 185 && total <= 210, `Upward input is consumed once across the switch: ${total}px`)
      smoothMonotonic([probe.initial, ...probe.frames], 'page', -1)
      smoothMonotonic([probe.initial, ...probe.frames], 'body', -1)
    })
    await check('After upward movement takes the body out from under the pointer, reversal scrolls the page in the same gesture', async () => {
      const box = await open(20)
      const point = { x: box.x + box.width / 2, y: box.y + 30 }
      await page.mouse.move(point.x, point.y)
      await beginProbe(point)
      await gesture(point, -240, 100)
      const probe = await endProbe()
      const reversal = probe.events.find(event => event.delta > 0)
      assert.ok(reversal && !reversal.hitBody, 'The same gesture reverses after the body has left the pointer')
      const reverseFrames = probe.frames.slice(reversal.frame)
      assert.ok(reverseFrames.every(frame => !frame.hitBody), 'The pointer remains over the page throughout reversal')
      assert.ok(reverseFrames.every(frame => frame.body <= 1), 'The old body target does not consume reversed page input')
      const pageStarted = probe.frames.findIndex((frame, index) => index >= reversal.frame && frame.page > reversal.page + 1)
      assert.ok(pageStarted >= 0 && pageStarted <= reversal.frame + 2, 'The page reverses within two frames')
      assert.ok(probe.events.filter(event => event.delta > 0).slice(1, -1).some(event => event.page > reversal.page + 30),
        'Page reversal makes progress before the gesture ends')
      assert.ok(probe.final.page - reversal.page > 70, 'Reversed input is delivered to the current page region')
      smoothMonotonic(probe.frames.slice(0, reversal.frame), 'page', -1)
      smoothMonotonic(reverseFrames, 'page')
    })
    await check('Moving the pointer sideways switches targets immediately and stops pending motion on the old target', async () => {
      const box = await open(60)
      // Cross by only four pixels so browser wheel-target slop cannot hide a
      // missing hit test by starting a new native target after a large move.
      const outside = { x: box.x - 2, y: box.y + 120 }
      const inside = { x: box.x + 2, y: outside.y }
      await page.mouse.move(outside.x, outside.y)
      await beginProbe(outside)
      await page.mouse.wheel(0, 80)
      await frames()
      await page.mouse.move(inside.x, inside.y)
      await mark('entered', inside)
      await page.mouse.wheel(0, 100)
      await frames(4)
      await mark('before-exit')
      await page.mouse.move(outside.x, outside.y)
      await mark('exited', outside)
      await page.mouse.wheel(0, 80)
      const probe = await endProbe()
      const entered = probe.marks.find(mark => mark.name === 'entered')
      const beforeExit = probe.marks.find(mark => mark.name === 'before-exit')
      const exited = probe.marks.find(mark => mark.name === 'exited')
      assert.equal(entered.hitBody, true, 'The pointer enters the body')
      assert.equal(exited.hitBody, false, 'The pointer leaves the body')
      assert.ok(beforeExit.time - entered.time < 350, 'The test switches again without waiting for a gesture timeout')
      assert.ok(beforeExit.body > entered.body + 10, 'The body responds while the pointer is over it')
      assert.ok(Math.abs(beforeExit.page - entered.page) <= 2, 'The old page animation stops on entry')
      assert.ok(Math.abs(probe.final.body - exited.body) <= 2, 'The old body animation stops on exit')
      assert.ok(probe.final.page > exited.page + 40, 'The page receives the next input immediately after exit')
      const bodyInput = probe.events.find(event => event.time >= entered.time && event.delta === 100)
      const pageInput = probe.events.find(event => event.time >= exited.time && event.delta === 80)
      const bodyStarted = probe.frames.findIndex((frame, index) => index >= bodyInput.frame && frame.body > entered.body)
      assert.ok(bodyStarted >= 0 && bodyStarted <= bodyInput.frame + 2, 'Body movement begins within two frames of input after entry')
      const pageStarted = probe.frames.findIndex((frame, index) => index >= pageInput.frame && frame.page > exited.page)
      assert.ok(pageStarted >= 0 && pageStarted <= pageInput.frame + 2, 'Page movement begins within two frames of input after exit')
      smoothMonotonic([probe.initial, ...probe.frames], 'page', 1, 80)
      smoothMonotonic([probe.initial, ...probe.frames], 'body', 1, 100)
    })
    assert.deepEqual(errors, [], 'No uncaught browser errors')
    assert.deepEqual(failures, [], 'Reader hover regression failures')
    return checks
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true, args: ['--enable-smooth-scrolling'] }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true, args: ['--enable-smooth-scrolling'] })
  try {
    const checks = await runProjectReaderHoverChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:4173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} project reader hover checks passed`)
  } catch (error) {
    console.error('Project reader hover checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
