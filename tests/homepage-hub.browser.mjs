import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { pathToFileURL } from 'node:url'

const outputDirectory = 'node_modules/.cache/hub-lifecycle'
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1 },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4 },
]

// Observe real browser work and registered handlers, without production debug APIs.
function instrument() {
  const nativeRequest = window.requestAnimationFrame.bind(window)
  const nativeCancel = window.cancelAnimationFrame.bind(window)
  const pending = new Map()
  const hubCallbacks = new WeakSet()
  const listeners = []
  const owners = new Set()
  let previousListeners = new Set()
  let executing = null
  let frames = 0
  let allFrames = 0
  let draws = 0
  let maxPending = 0
  let cells = []
  const hubPending = () => [...pending.values()].filter(callback => hubCallbacks.has(callback)).length
  window.requestAnimationFrame = callback => {
    const id = nativeRequest(time => {
      allFrames++
      pending.delete(id)
      executing = callback
      try { callback(time) } finally {
        if (hubCallbacks.has(callback)) frames++
        executing = null
      }
    })
    pending.set(id, callback)
    maxPending = Math.max(maxPending, hubPending())
    return id
  }
  window.cancelAnimationFrame = id => { pending.delete(id); nativeCancel(id) }
  const prototype = CanvasRenderingContext2D.prototype
  const clear = prototype.clearRect
  const fill = prototype.fillRect
  prototype.clearRect = function (...args) {
    if (this.canvas.matches('.homepage-hub-canvas')) {
      if (executing) hubCallbacks.add(executing)
      draws++
      cells = []
    }
    return clear.apply(this, args)
  }
  prototype.fillRect = function (x, y, width, height) {
    if (this.canvas.matches('.homepage-hub-canvas') && width === 40 && height === 40) {
      cells.push({ x, y, fill: this.fillStyle, alpha: this.globalAlpha })
    }
    return fill.call(this, x, y, width, height)
  }
  const add = EventTarget.prototype.addEventListener
  const remove = EventTarget.prototype.removeEventListener
  const capture = options => typeof options === 'boolean' ? options : Boolean(options?.capture)
  const relevant = (target, type) => (
    (target === window && ['resize', 'blur', 'pagehide', 'pageshow'].includes(type))
    || (target === document && type === 'visibilitychange')
    || (target === document.fonts && type === 'loadingdone')
    || (target instanceof MediaQueryList && type === 'change')
    || (target instanceof Element && target.matches('.homepage-hub') && type.startsWith('pointer'))
  )
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if (relevant(this, type) && !listeners.some(item => item.target === this && item.type === type
      && item.callback === callback && item.capture === capture(options))) {
      listeners.push({ target: this, type, callback, capture: capture(options) })
    }
    return add.call(this, type, callback, options)
  }
  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    const index = listeners.findIndex(item => item.target === this && item.type === type
      && item.callback === callback && item.capture === capture(options))
    if (index >= 0) listeners.splice(index, 1)
    return remove.call(this, type, callback, options)
  }
  window.__hubProbe = {
    read: () => ({ frames, allFrames, allPending: pending.size, draws, pending: hubPending(), maxPending, cells,
      ownedListeners: listeners.filter(item => owners.has(item)).length }),
    reset: () => { frames = 0; draws = 0; maxPending = hubPending() },
    markListeners: () => { previousListeners = new Set(listeners) },
    captureOwners: () => {
      for (const item of listeners) {
        // Compare registrations before and after activation, including global
        // lifecycle and font handlers as well as the surface/media listeners.
        if (!previousListeners.has(item)) owners.add(item)
      }
      return window.__hubProbe.read().ownedListeners
    },
    signature: () => {
      const canvas = document.querySelector('.homepage-hub-canvas')
      const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      let hash = 2166136261
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619)
      return hash >>> 0
    },
  }
}

const read = page => page.evaluate(() => window.__hubProbe.read())
const signature = page => page.evaluate(() => window.__hubProbe.signature())
const setHidden = (page, hidden) => page.evaluate(value => {
  if (value) Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  else delete document.hidden
  document.dispatchEvent(new Event('visibilitychange'))
}, hidden)

async function enter(page, url) {
  if (url) await page.goto(url)
  await page.locator('.launch-intro-enter').waitFor()
  await page.evaluate(() => window.__hubProbe.markListeners())
  await page.keyboard.press('Enter')
  await page.locator('.homepage-portal[data-phase="hub"]').waitFor()
  await page.waitForFunction(() => document.querySelector('.homepage-hub-canvas')?.width > 300)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(120)
}

async function idle(page, label) {
  await page.waitForTimeout(100)
  const before = await read(page)
  await page.waitForTimeout(200)
  const after = await read(page)
  assert.equal(after.frames - before.frames, 0, `${label}: no Hub rAF callbacks`)
  assert.equal(after.draws - before.draws, 0, `${label}: no Canvas draws`)
  assert.equal(after.pending, 0, `${label}: no queued Hub frame`)
}

async function moving(page, label) {
  const before = await read(page)
  await page.waitForTimeout(160)
  const after = await read(page)
  assert.ok(after.draws > before.draws + 1, `${label}: drawing resumes`)
  assert.equal(after.pending, 1, `${label}: one queued Hub frame`)
  assert.equal(after.maxPending, 1, `${label}: no duplicate loops`)
}

export async function runHubLifecycleChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  for (const profile of profiles) {
    const { name, cpu, ...options } = profile
    const context = await browser.newContext({ ...options, reducedMotion: 'reduce' })
    await context.addInitScript(instrument)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const session = await context.newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    try {
      await page.goto(baseURL)
      await page.locator('.launch-intro-enter').waitFor()
      await setHidden(page, true)
      await page.keyboard.press('Enter')
      await page.locator('.homepage-portal[data-phase="hub"]').waitFor()
      await idle(page, `${name} activated while hidden`)
      assert.equal((await read(page)).draws, 0, 'Hidden activation does not initialize or paint the bitmap')
      const hiddenFrames = (await read(page)).allFrames
      await page.waitForTimeout(200)
      assert.equal((await read(page)).allFrames, hiddenFrames, 'Hidden activation does not start an unobserved loop')
      assert.equal((await read(page)).allPending, 0)
      await setHidden(page, false)
      await page.waitForFunction(() => window.__hubProbe.read().draws > 0)
      await idle(page, `${name} first visible reduced frame`)
      pass(`${name}: activation while hidden waits until visible to render a static frame`)

      await enter(page, baseURL)
      assert.equal(await page.locator('.homepage-hub-canvas').isVisible(), true)
      const initial = await signature(page)
      await idle(page, `${name} cold reduced`)
      assert.equal(await signature(page), initial, 'Reduced grid stays visually stationary')
      assert.equal(await page.locator('.homepage-portal-hub').evaluate(element => element.inert), false)
      assert.equal(await page.locator('.homepage-hub').evaluate(element => element.getAnimations({ subtree: true }).length), 0)
      pass(`${name}: cold reduced mode has a visible static grid, no running animation or frame loop`)

      const surface = page.locator('.homepage-hub')
      if (options.hasTouch) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 100 }] })
      } else await page.mouse.move(100, 100)
      await page.waitForTimeout(100)
      assert.ok((await read(page)).cells.some(cell => cell.fill.startsWith('rgba(255, 255, 255,')), 'Input highlights the current cell')
      await idle(page, `${name} held pointer`)
      if (options.hasTouch) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      else await surface.dispatchEvent('pointerleave', { pointerType: 'mouse' })
      await idle(page, `${name} released pointer`)
      assert.equal((await read(page)).cells.some(cell => cell.fill.startsWith('rgba(255, 255, 255,') || cell.fill === '#dae7ff'), false)
      pass(`${name}: reduced pointer/touch feedback draws on demand and clears without a fade`)

      for (const viewport of options.hasTouch
        ? [{ width: 844, height: 390 }, options.viewport]
        : [{ width: 640, height: 900 }, { width: 641, height: 900 }, options.viewport]) {
        await page.setViewportSize(viewport)
        await idle(page, `${name} reduced layout change`)
        const desktop = await page.evaluate(() => matchMedia('(min-width: 641px) and (hover: hover) and (pointer: fine)').matches)
        assert.equal((await read(page)).cells.filter(cell => cell.fill.startsWith('rgba(100, 255, 152,')).length, desktop ? 1 : 0)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
      const beforeFonts = (await read(page)).draws
      await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')))
      await page.waitForFunction(count => window.__hubProbe.read().draws > count, beforeFonts)
      await idle(page, `${name} font completion`)
      pass(`${name}: reduced resizing, input layout and font completion redraw once then settle`)

      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await moving(page, `${name} preference restored`)
      const owners = await page.evaluate(() => window.__hubProbe.captureOwners())
      assert.ok(owners > 5, 'Track global/media handlers as well as pointer handlers')
      await surface.dispatchEvent('pointermove', { clientX: 100, clientY: 100, pointerType: options.hasTouch ? 'touch' : 'mouse' })
      await page.waitForFunction(() => window.__hubProbe.read().cells.some(cell => cell.fill.startsWith('rgba(255, 255, 255,')))
      await setHidden(page, true)
      const paused = await signature(page)
      await idle(page, `${name} hidden`)
      await page.setViewportSize({ width: options.viewport.width + 10, height: options.viewport.height })
      await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')))
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await surface.dispatchEvent('pointermove', { clientX: 180, clientY: 100, pointerType: 'mouse' })
      await idle(page, `${name} hidden resize and preference`)
      assert.equal(await signature(page), paused, 'Hidden events must not resize or redraw the bitmap')
      await setHidden(page, false)
      await idle(page, `${name} visible reduced`)
      assert.equal((await read(page)).cells.some(cell => cell.fill.startsWith('rgba(255, 255, 255,') || cell.fill === '#dae7ff'), false,
        'Restoring visibility must not replay a stale pointer or trail')
      assert.equal(await page.locator('canvas.homepage-hub-canvas').evaluate(canvas => canvas.width),
        Math.floor((options.viewport.width + 10) * Math.min(options.deviceScaleFactor, 2)))
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await moving(page, `${name} visible normal`)
      pass(`${name}: hidden work stops, layout and preference changes defer, visible mode resumes correctly`)

      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
      await idle(page, `${name} pagehide`)
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
      await moving(page, `${name} pageshow`)
      pass(`${name}: page lifecycle pause and resume leaves a single loop`)

      for (let cycle = 0; cycle < 20; cycle++) {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await setHidden(page, true)
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
        await setHidden(page, false)
      }
      await moving(page, `${name} repeated changes`)
      assert.equal((await read(page)).ownedListeners, owners)
      pass(`${name}: 20 preference/visibility cycles do not multiply loops or listeners`)

      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize(options.viewport)
      await idle(page, `${name} reduced before navigation`)
      await page.locator('.homepage-portal-hub').focus()
      await page.keyboard.press('Tab')
      assert.equal(await page.locator('.homepage-hub-github').evaluate(element => element === document.activeElement), true)
      await page.keyboard.press('Tab')
      assert.equal(await page.locator('.homepage-hub-link').first().evaluate(element => element === document.activeElement), true)
      assert.equal(await page.locator('.homepage-hub-link').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s')
      assert.equal(await page.locator('.homepage-hub-github').evaluate(element => getComputedStyle(element).transitionDuration), '0s')
      assert.equal(await page.locator('.homepage-hub-canvas').evaluate(element => getComputedStyle(element).transitionDuration), '0s')
      await page.keyboard.press('Enter')
      await page.waitForURL('**/home/')
      await page.locator('.homepage-hub').waitFor({ state: 'detached' })
      await idle(page, `${name} route left`)
      assert.equal((await read(page)).ownedListeners, 0, 'Unmount removes all owned listeners')
      await page.goBack()
      await enter(page)
      pass(`${name}: keyboard focus and navigation work in reduced mode; route exit cleans up`)

      for (let cycle = 0; cycle < 20; cycle++) {
        await page.evaluate(() => window.__hubProbe.captureOwners())
        // Include normal-mode exit with a queued frame in the same SPA document.
        if (cycle % 2 === 0) await page.emulateMedia({ reducedMotion: 'no-preference' })
        await page.locator('.homepage-hub-link[href$="/home/"]').click()
        await page.waitForURL('**/home/')
        await page.locator('.homepage-hub').waitFor({ state: 'detached' })
        assert.equal((await read(page)).ownedListeners, 0)
        assert.equal((await read(page)).pending, 0)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goBack()
        await enter(page)
        assert.equal(await page.evaluate(() => window.__hubProbe.captureOwners()), owners)
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await moving(page, `${name} route returns`)
      pass(`${name}: 20 SPA exit/return cycles release old handlers and restart only one loop`)
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  return checks
}

async function realTabs(context, baseURL) {
  await context.addInitScript(instrument)
  try {
    const page = await context.newPage()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await enter(page, baseURL)
    const session = await context.newCDPSession(page)
    await page.evaluate(() => {
      window.__visibilityEvents = []
      document.addEventListener('visibilitychange', event => {
        window.__visibilityEvents.push({ hidden: document.hidden, trusted: event.isTrusted })
      })
    })
    const { targetInfo } = await session.send('Target.getTargetInfo')
    const opened = context.waitForEvent('page')
    await session.send('Target.createTarget', { url: 'about:blank', browserContextId: targetInfo.browserContextId, newWindow: false })
    const other = await opened
    const otherSession = await context.newCDPSession(other)
    await other.bringToFront()
    await page.waitForFunction(() => document.hidden, undefined, { timeout: 5000, polling: 100 }).catch(async error => {
      const firstWindow = await session.send('Browser.getWindowForTarget')
      const secondWindow = await otherSession.send('Browser.getWindowForTarget')
      console.log(JSON.stringify({ sameWindow: firstWindow.windowId === secondWindow.windowId,
        first: await page.evaluate(() => ({ visibility: document.visibilityState, focus: document.hasFocus(), events: window.__visibilityEvents })),
        second: await other.evaluate(() => ({ visibility: document.visibilityState, focus: document.hasFocus() })),
      }))
      throw error
    })
    await idle(page, 'Real background tab')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await idle(page, 'Real background preference change')
    await page.bringToFront()
    await page.waitForFunction(() => !document.hidden)
    await idle(page, 'Real foreground reduced')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await moving(page, 'Real foreground normal')
    const events = await page.evaluate(() => window.__visibilityEvents)
    assert.ok(events.some(event => event.hidden && event.trusted))
    assert.ok(events.some(event => !event.hidden && event.trusted))
    console.log('PASS: real tab switch cancels work and restores the current preference')
  } finally { await Promise.all(context.pages().map(page => page.close())) }
}

async function measure(browser, baseURL, label, samples) {
  for (const { name, cpu, ...options } of profiles) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ ...options, reducedMotion: 'no-preference' })
      await context.addInitScript(instrument)
      const page = await context.newPage()
      const session = await context.newCDPSession(page)
      try {
        await session.send('Emulation.setCPUThrottlingRate', { rate: cpu })
        await session.send('Performance.enable')
        await enter(page, baseURL)
        await page.waitForTimeout(800)
        const metrics = async () => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]))
        for (const state of ['normal', 'reduced', 'hidden', 'restored']) {
          if (state === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' })
          if (state === 'hidden') {
            await page.emulateMedia({ reducedMotion: 'no-preference' })
            await setHidden(page, true)
          }
          if (state === 'restored') await setHidden(page, false)
          await page.waitForTimeout(150)
          await page.evaluate(() => window.__hubProbe.reset())
          const before = await metrics()
          await page.waitForTimeout(2000)
          const after = await metrics()
          const work = await read(page)
          const elapsed = after.Timestamp - before.Timestamp
          samples.push({ label, profile: name, cpuSlowdown: cpu, run, state,
            sampleMs: Math.round(elapsed * 1000), frames: work.frames, draws: work.draws, pending: work.pending,
            taskMs: Number(((after.TaskDuration - before.TaskDuration) * 1000).toFixed(2)),
            scriptMs: Number(((after.ScriptDuration - before.ScriptDuration) * 1000).toFixed(2)),
            taskPercent: Number(((after.TaskDuration - before.TaskDuration) / elapsed * 100).toFixed(2)),
          })
        }
      } finally { await context.close() }
    }
    console.log(`MEASURED: ${label}, ${name}, 3 runs of 4 states`)
  }
}

// Freeze only the Canvas callback at a matching normal-mode frame, with a
// deterministic target location. CSS and navigation run on the real clock.
function visualClock() {
  let seed = 37
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const request = window.requestAnimationFrame.bind(window)
  const clear = CanvasRenderingContext2D.prototype.clearRect
  const callbacks = new Map()
  let executing
  let timestamp
  window.__hubVisualFrames = 0
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (executing && this.canvas.matches('.homepage-hub-canvas') && !callbacks.has(executing)) {
      callbacks.set(executing, { start: timestamp, count: 0 })
    }
    return clear.apply(this, args)
  }
  window.requestAnimationFrame = callback => request(time => {
    const clock = callbacks.get(callback)
    if (clock?.count >= 30) return
    executing = callback
    timestamp = time
    try { callback(clock ? clock.start + clock.count * 16 : time) } finally {
      const current = callbacks.get(callback)
      if (current) window.__hubVisualFrames = ++current.count
      executing = null
    }
  })
}

async function visuals(browser, baseURL, baselineURL) {
  const sharp = (await import('sharp')).default
  const comparisons = []
  for (const { name, cpu: _cpu, ...options } of [...profiles,
    { name: 'landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }]) {
    for (const preference of ['no-preference', 'reduce']) {
      const snapshots = []
      const canvasStates = []
      for (const [label, url] of [['baseline', baselineURL], ['candidate', baseURL]]) {
        if (!url) continue
        const context = await browser.newContext({ ...options, reducedMotion: preference })
        await context.addInitScript(visualClock)
        try {
          const page = await context.newPage()
          await page.goto(url)
          await page.locator('.launch-intro-enter').waitFor()
          await page.evaluate(() => document.fonts.ready)
          await page.keyboard.press('Enter')
          await page.locator('.homepage-portal[data-phase="hub"]').waitFor()
          await page.locator('.homepage-hub-avatar img').evaluate(image => image.decode())
          await page.evaluate(() => document.fonts.ready)
          if (preference === 'no-preference') await page.waitForFunction(() => window.__hubVisualFrames === 30)
          await page.waitForFunction(() => document.querySelector('.homepage-hub')
            .getAnimations({ subtree: true }).every(animation => animation.playState === 'finished'))
          // Let the compositor present the settled CSS and frozen Canvas frame.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          canvasStates.push(await page.locator('.homepage-hub-canvas').evaluate(canvas => {
            let hash = 2166136261
            const pixels = canvas.width && canvas.height
              ? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data : []
            for (const byte of pixels) {
              hash = Math.imul(hash ^ byte, 16777619)
            }
            return { width: canvas.width, height: canvas.height, hash: hash >>> 0,
              opacity: getComputedStyle(canvas).opacity, frames: window.__hubVisualFrames,
              styles: ['.homepage-hub', '.homepage-hub-canvas', '.homepage-hub-content', '.homepage-portal-hub'].flatMap(selector => {
                const element = document.querySelector(selector)
                return [null, '::before', '::after'].map(pseudo => {
                  const style = getComputedStyle(element, pseudo)
                  const rect = element.getBoundingClientRect()
                  return { selector, pseudo, rect: rect.toJSON(), opacity: style.opacity, transform: style.transform,
                    background: style.background, filter: style.filter, color: style.color, willChange: style.willChange }
                })
              }) }
          }))
          const buffer = await page.screenshot({ path: `${outputDirectory}/${label}-${name}-${preference}.png` })
          snapshots.push(await sharp(buffer).ensureAlpha().raw().toBuffer())
        } finally { await context.close() }
      }
      if (snapshots.length === 2) {
        assert.equal(snapshots[0].length, snapshots[1].length)
        let differentPixels = 0
        for (let index = 0; index < snapshots[0].length; index += 4) {
          if (snapshots[0].subarray(index, index + 4).compare(snapshots[1].subarray(index, index + 4))) differentPixels++
        }
        comparisons.push({ profile: name, preference, differentPixels, totalPixels: snapshots[0].length / 4 })
        if (preference === 'no-preference') {
          assert.deepEqual(canvasStates[1], canvasStates[0], `${name}: Canvas output matches at frame 30`)
          assert.equal(differentPixels, 0, `${name}: normal visuals match at frame 30`)
        }
      }
    }
    console.log(`VISUAL: ${name}, normal and reduced captures saved`)
  }
  await writeFile(`${outputDirectory}/visuals.json`, JSON.stringify({ comparisons }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let browser
  try {
    const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
    const realTabCheck = process.argv.includes('--real-tabs')
    let debugPort
    if (realTabCheck) {
      const server = createServer()
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      debugPort = server.address().port
      await new Promise(resolve => server.close(resolve))
    }
    browser = await chromium.launch({ ...(process.env.HOMEPAGE_BROWSER_EXECUTABLE
      ? { executablePath: process.env.HOMEPAGE_BROWSER_EXECUTABLE }
      : { channel: process.env.HOMEPAGE_BROWSER_CHANNEL || 'msedge' }), headless: !realTabCheck,
      ...(realTabCheck ? { args: [`--remote-debugging-port=${debugPort}`], ignoreDefaultArgs: [
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      ] } : {}) })
    const baseURL = process.env.HOMEPAGE_TEST_URL || 'http://127.0.0.1:4173/'
    await mkdir(outputDirectory, { recursive: true })
    if (realTabCheck) {
      // Ordinary Playwright contexts force page visibility through focus
      // emulation. Use the isolated browser's default context without overrides.
      const observer = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { noDefaults: true })
      try { await realTabs(observer.contexts()[0], baseURL) } finally { await observer.close() }
    }
    else if (process.argv.includes('--visual')) await visuals(browser, baseURL, process.env.HUB_BASELINE_URL)
    else if (process.argv.includes('--measure')) {
      const samples = []
      if (process.env.HUB_BASELINE_URL) await measure(browser, process.env.HUB_BASELINE_URL, 'baseline', samples)
      await measure(browser, baseURL, 'candidate', samples)
      await writeFile(`${outputDirectory}/measurements.json`, JSON.stringify({ browser: browser.version(), samples }, null, 2))
      console.log('Saved measurements to the ignored Hub lifecycle cache')
    } else {
      const checks = await runHubLifecycleChecks(browser, baseURL, name => console.log(`PASS: ${name}`))
      await writeFile(`${outputDirectory}/checks.json`, JSON.stringify({ checks }, null, 2))
      console.log(`${checks.length} Hub lifecycle checks passed`)
    }
  } catch (error) {
    // Do not print host paths from Playwright launch errors or assertion stacks.
    console.error('Hub verification failed:', error.message.split('\n')[0]
      .replace(/[A-Za-z]:[\\/][^\n]+|\/(?:Users|home|tmp|var|opt)\/[^\n]+/g, '<local-path>'))
    process.exitCode = 1
  } finally { await browser?.close() }
}
