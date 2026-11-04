import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
  ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
  : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
const baseURL = process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:4173/'
const files = ['poster', 'comparison', 'training', 'reconstructions', 'ablation', 'grids', 'samples']
const original = index => `/images/projects/vaegan-${files[index]}.webp`
const thumb = (page, index) => page.getByRole('button', { name: `第 ${index + 1} 张，共 7 张` })
const dialog = page => page.getByRole('dialog', { name: '图片浏览器' })
const cover = page => page.locator('.project-reader-cover .project-reader-image-trigger')
const errors = []
const results = []
const pass = message => { results.push(message); console.log(`PASS: ${message}`) }
const contextOptions = { viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', serviceWorkers: 'block' }
const open = async (context, url = baseURL) => {
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(new URL('projects/vae-gan-digits/', url).href, { waitUntil: 'domcontentloaded' })
  await cover(page).click()
  await dialog(page).waitFor()
  return page
}
const settled = async (page, index, full = true) => {
  await page.waitForFunction(({ index, full, file }) => {
    const slide = document.querySelector('.yarl__slide_current')
    const image = slide?.querySelector('img')
    return slide?.getAttribute('aria-label') === `第 ${index + 1} 张，共 7 张`
      && image?.complete && image.naturalWidth > 0 && getComputedStyle(image).visibility !== 'hidden'
      && (!full || image.src.endsWith(file))
      && !document.querySelector('.yarl__carousel').getAnimations().some(animation => animation.playState === 'running' || animation.pending)
  }, { index, full, file: original(index) }, { timeout: 15000 }).catch(async () => {
    const state = await page.evaluate(() => ({
      selected: document.querySelector('.yarl__slide_current')?.getAttribute('aria-label'),
      images: [...document.querySelectorAll('.yarl__slide_current img')].map(image => ({ src: new URL(image.src).pathname, complete: image.complete, visibility: getComputedStyle(image).visibility })),
      status: document.querySelector('.yarl__slide_current [role="status"]')?.textContent,
    }))
    throw new Error(`Selection ${index + 1} (${full ? 'original' : 'preview'}) did not settle: ${JSON.stringify(state)}`)
  })
}
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve }); return { promise, release } }
const bounded = async (promise, label) => {
  let timer
  try { await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 10000) })]) }
  finally { clearTimeout(timer) }
}

async function checkColdOpen() {
  const context = await browser.newContext(contextOptions)
  const pending = gate()
  const requested = gate()
  try {
    await context.route(`**${original(0)}`, async route => { requested.release(); await pending.promise; await route.continue().catch(() => {}) })
    const page = await open(context)
    await bounded(requested.promise, 'The selected original starts on cold open')
    await settled(page, 0, false)
    assert.ok(await dialog(page).getByText('正在加载原图…').isVisible())
    assert.equal(await page.locator('.gallery-original').count(), 0)
    await page.keyboard.press('Escape')
    await dialog(page).waitFor({ state: 'detached' })
    assert.ok(await cover(page).evaluate(element => document.activeElement === element))
    pending.release()
    await cover(page).click()
    await settled(page, 0)
    pass('Cold opening displays a preview while the original is pending, closes immediately and reopens successfully')
  } finally { pending.release(); await context.close() }
}

async function checkIntermediate() {
  for (const failure of ['stall', 'abort']) {
    const context = await browser.newContext(contextOptions)
    const pending = gate()
    let intercepted = 0
    try {
      await context.route(`**${original(3)}`, async route => {
        intercepted++
        if (failure === 'stall') await pending.promise
        await route.abort().catch(() => {})
      })
      const page = await open(context)
      await settled(page, 0)
      await page.waitForTimeout(350)
      const requests = []
      page.on('request', request => { if (/\/images\/projects\/vaegan-/.test(request.url())) requests.push(new URL(request.url()).pathname) })
      await thumb(page, 6).click()
      await settled(page, 6)
      await page.waitForTimeout(350)
      assert.equal(intercepted, 0, 'The intermediate original is not requested at all')
      assert.equal(requests[0], original(6), 'The target original starts before speculative neighbors')
      assert.deepEqual([...new Set(requests)], [original(6), original(5)])
      assert.ok(await page.locator('.gallery-original').count() <= 3)
      pass(`A ${failure === 'stall' ? 'stalled' : 'failed'} intermediate original cannot block first-to-last traversal; only target and final neighbor are requested`)
    } finally { pending.release(); await context.close() }
  }
}

async function checkRetargeting() {
  for (const late of ['success', 'failure']) {
    const context = await browser.newContext(contextOptions)
    const pending = gate()
    const requested = gate()
    try {
      await context.route(`**${original(6)}`, async route => {
        requested.release(); await pending.promise
        if (late === 'failure') await route.abort().catch(() => {})
        else await route.continue().catch(() => {})
      })
      const page = await open(context)
      await settled(page, 0)
      await thumb(page, 6).click()
      await bounded(requested.promise, 'The distant original starts without waiting for animation')
      await page.evaluate(() => {
        for (const index of [3, 5, 1]) document.querySelector(`button:not(.yarl__thumbnails_thumbnail_placeholder)[aria-label="第 ${index + 1} 张，共 7 张"]`).click()
      })
      await settled(page, 1)
      pending.release()
      await page.waitForTimeout(400)
      await settled(page, 1)
      assert.equal(await page.locator('.gallery-error').count(), 0)
      assert.equal(await page.locator('[aria-busy="true"]').count(), 0)
      pass(`Rapid reselection keeps only the latest target after an obsolete ${late}`)
    } finally { pending.release(); await context.close() }
  }
  const context = await browser.newContext(contextOptions)
  try {
    const page = await open(context)
    await settled(page, 0)
    for (const targets of [[1, 6], [1, 2], [4, 5]]) {
      await page.evaluate(targets => {
        for (const target of targets) document.querySelector(`button:not(.yarl__thumbnails_thumbnail_placeholder)[aria-label="第 ${target + 1} 张，共 7 张"]`).click()
      }, targets)
      await settled(page, targets.at(-1))
      await thumb(page, 0).click()
      await settled(page, 0)
    }
    pass('Adjacent and distant thumbnail clicks in the same frame resolve to the final absolute target')
    await page.evaluate(() => {
      document.querySelector('button:not(.yarl__thumbnails_thumbnail_placeholder)[aria-label="第 7 张，共 7 张"]').click()
      document.querySelector('.yarl__container').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    await settled(page, 1)
    await page.waitForTimeout(200)
    await settled(page, 1)
    await thumb(page, 6).click()
    await page.waitForFunction(() => document.querySelector('.yarl__carousel').getAnimations().some(animation => animation.playState === 'running'))
    await page.keyboard.press('ArrowLeft')
    await settled(page, 5)
    pass('Keyboard input supersedes both a prepared thumbnail selection and an active traversal')
  } finally { await context.close() }
}

async function checkDistanceBudget() {
  for (const target of [2, 4, 6]) {
    const context = await browser.newContext(contextOptions)
    try {
      const page = await open(context)
      await settled(page, 0)
      await page.waitForTimeout(350)
      const requested = []
      page.on('request', request => { if (/\/images\/projects\/vaegan-/.test(request.url())) requested.push(new URL(request.url()).pathname) })
      await thumb(page, target).click()
      await settled(page, target)
      await page.waitForTimeout(400)
      assert.equal(requested[0], original(target))
      assert.ok(requested.length <= 3)
      assert.equal(new Set(requested).size, requested.length, 'Each candidate has at most one network request')
      assert.ok(requested.every(path => [target - 1, target, target + 1].filter(index => files[index]).map(original).includes(path)))
      assert.ok(await page.locator('.gallery-original').count() <= 3)
      pass(`A ${target}-step jump requests at most three originals, confined to the destination and its neighbors`)
    } finally { await context.close() }
  }
}

async function checkRecovery() {
  for (const failure of ['abort', '404', 'decode', 'timeout']) {
    const context = await browser.newContext({ ...contextOptions, reducedMotion: 'reduce' })
    const pending = gate()
    let fail = true
    try {
      await context.route(`**${original(6)}`, async route => {
        if (!fail) return route.continue()
        if (failure === 'abort') return route.abort()
        if (failure === '404') return route.fulfill({ status: 404, body: '' })
        if (failure === 'decode') return route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid image' })
        await pending.promise
        await route.continue().catch(() => {})
      })
      const page = await open(context)
      await settled(page, 0)
      await thumb(page, 6).click()
      await settled(page, 6, false)
      await page.getByRole('button', { name: '重试原图' }).waitFor({ timeout: 12000 })
      const before = await page.locator('.yarl__slide_current .gallery-preview').boundingBox()
      assert.ok(before.width > 100 && before.height > 100, 'The target preview remains visible on failure')
      assert.ok(await page.getByRole('button', { name: '关闭图片预览' }).isEnabled())
      fail = false
      await page.getByRole('button', { name: '重试原图' }).click()
      pending.release()
      await settled(page, 6)
      assert.ok(await page.locator('.yarl__container').evaluate(element => document.activeElement === element), 'Retry returns focus to the viewer before removing its button')
      const after = await page.locator('.yarl__slide_current img').boundingBox()
      for (const dimension of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[dimension] - after[dimension]) < 1, `No ${dimension} jump when preview becomes original`)
      await page.keyboard.press('ArrowLeft')
      await settled(page, 5)
      await page.keyboard.press('ArrowRight')
      await settled(page, 6)
      await page.getByRole('button', { name: '放大图片', exact: true }).click()
      assert.equal(await page.locator('.gallery-zoom-reset').textContent(), '150%')
      assert.ok((await page.locator('.yarl__slide_current img').getAttribute('src')).endsWith(original(6)))
      pass(`${failure} exposes in-place retry, preserves the preview and restores full-resolution zoom without a layout jump`)
    } finally { pending.release(); await context.close() }
  }
}

async function checkSpeculation() {
  const context = await browser.newContext(contextOptions)
  try {
    await context.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }))
    const page = await open(context)
    await settled(page, 0)
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.gallery-original').count(), 1)
    await thumb(page, 6).click()
    await settled(page, 6)
    await page.waitForTimeout(300)
    const originals = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\/images\/projects\/vaegan-/.test(entry.name)).map(entry => new URL(entry.name).pathname))
    assert.deepEqual([...new Set(originals)], [original(0), original(6)])
    pass('Save-data mode retains target originals and preview navigation without speculative originals')
  } finally { await context.close() }
}

async function checkMobileRecovery() {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ ...contextOptions, viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' })
    let fail = true
    try {
      await context.route(`**${original(6)}`, route => fail ? route.abort() : route.continue())
      const page = await open(context)
      await settled(page, 0)
      await thumb(page, 6).evaluate(button => button.click())
      const retry = page.getByRole('button', { name: '重试原图' })
      await retry.waitFor()
      const box = await retry.boundingBox()
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height)
      await page.screenshot({ path: `node_modules/.cache/gallery-loading/failure-${viewport.width}.png` })
      fail = false
      await retry.tap()
      await settled(page, 6)
      await page.getByRole('button', { name: '关闭图片预览' }).tap()
      await dialog(page).waitFor({ state: 'detached' })
      assert.ok(await cover(page).evaluate(element => document.activeElement === element))
      pass(`${viewport.width}px touch recovery keeps retry inside the viewport and restores focus on close`)
    } finally { await context.close() }
  }
}

async function checkFallbackAndPromotion() {
  const failed = await browser.newContext({ ...contextOptions, reducedMotion: 'reduce' })
  try {
    await failed.route('**/images/**/vaegan-samples*.webp', route => route.abort())
    const page = await open(failed)
    await settled(page, 0)
    await thumb(page, 6).click()
    await page.locator('.yarl__slide_current .gallery-error').waitFor()
    const fallback = page.locator('.yarl__slide_current .gallery-original')
    await fallback.waitFor()
    assert.ok(await fallback.evaluate(image => image.src.endsWith('/vaegan-poster.webp') && image.complete && image.naturalWidth > 0))
    await thumb(page, 2).click()
    await settled(page, 2)
    pass('Failure of both target and preview retains the previous picture; choosing another target recovers')
  } finally { await failed.close() }

  const context = await browser.newContext({ ...contextOptions, reducedMotion: 'reduce' })
  const pending = gate()
  const requested = gate()
  let count = 0
  try {
    await context.route(`**${original(1)}`, async route => {
      count++; requested.release(); await pending.promise; await route.continue().catch(() => {})
    })
    const page = await open(context)
    await settled(page, 0)
    await bounded(requested.promise, 'One neighbor starts after the current original')
    await thumb(page, 1).click()
    await settled(page, 1, false)
    assert.equal(count, 1, 'Selecting a pending neighbor reuses the same request')
    pending.release()
    await settled(page, 1)
    pass('Selecting an in-flight neighbor promotes and reuses its request')
  } finally { pending.release(); await context.close() }

  const hidden = await browser.newContext({ ...contextOptions, reducedMotion: 'reduce' })
  try {
    await hidden.addInitScript(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.galleryHidden ?? false })
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.galleryHidden ? 'hidden' : 'visible' })
      window.galleryHidden = true
    })
    const page = await open(hidden)
    await settled(page, 0)
    await page.waitForTimeout(400)
    assert.equal(await page.locator('.gallery-original').count(), 1)
    await page.evaluate(() => { window.galleryHidden = false; document.dispatchEvent(new Event('visibilitychange')) })
    await page.waitForFunction(() => document.querySelectorAll('.gallery-original').length === 2)
    pass('Synthetic hidden state suppresses speculative originals and visibility restoration resumes preparation')
  } finally { await hidden.close() }
}

async function checkLifecycle() {
  const context = await browser.newContext({ ...contextOptions, reducedMotion: 'reduce' })
  const cycles = []
  try {
    const page = await open(context)
    const session = await context.newCDPSession(page)
    await session.send('Performance.enable')
    for (let cycle = 1; cycle <= 20; cycle++) {
      if (cycle > 1) await cover(page).click()
      await settled(page, 0)
      await thumb(page, 6).click()
      await settled(page, 6)
      await page.keyboard.press('Escape')
      await dialog(page).waitFor({ state: 'detached' })
      assert.equal(await page.locator('.gallery-original, .gallery-preview, [aria-busy="true"]').count(), 0)
      assert.ok(await cover(page).evaluate(element => document.activeElement === element))
      if (cycle === 1 || cycle % 5 === 0) await session.send('HeapProfiler.collectGarbage')
      const metrics = (await session.send('Performance.getMetrics')).metrics
      cycles.push({ cycle, dom: await page.locator('*').count(), ...Object.fromEntries(metrics.filter(metric =>
        ['JSHeapUsedSize', 'Nodes', 'JSEventListeners'].includes(metric.name)).map(metric => [metric.name, metric.value])) })
    }
    // GC separates retained nodes from uncollected detached subtrees. GPU memory is not measured.
    await session.send('HeapProfiler.collectGarbage')
    const retained = await session.send('Memory.getDOMCounters')
    assert.ok(cycles.at(-1).dom <= cycles[0].dom + 5)
    await writeFile('node_modules/.cache/gallery-loading/lifecycle.json', JSON.stringify({ cycles, retained }, null, 2))
    pass('Twenty open/jump/close cycles release gallery DOM, busy feedback, scroll locks and focus; heap and listener trends recorded')
  } finally { await context.close() }
}

async function measure(url, label) {
  const samples = []
  for (const profile of [
    { name: 'desktop', viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, cpu: 1 },
    { name: 'mobile-constrained', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4 },
  ]) {
    const { name, cpu, ...options } = profile
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ ...contextOptions, ...options })
      try {
        const page = await context.newPage()
        page.on('pageerror', error => errors.push(error.message))
        const session = await context.newCDPSession(page)
        await session.send('Network.enable')
        await session.send('Emulation.setCPUThrottlingRate', { rate: cpu })
        if (cpu > 1) await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 })
        const requests = new Map()
        session.on('Network.requestWillBeSent', event => {
          if (event.type === 'Image') requests.set(event.requestId, { path: new URL(event.request.url).pathname, priority: event.request.initialPriority, bytes: 0, receivedBodyBytes: 0, complete: false, failed: false, canceled: false, cached: false })
        })
        session.on('Network.requestServedFromCache', event => { const item = requests.get(event.requestId); if (item) item.cached = true })
        session.on('Network.loadingFinished', event => { const item = requests.get(event.requestId); if (item) { item.complete = true; item.bytes = event.encodedDataLength } })
        session.on('Network.dataReceived', event => { const item = requests.get(event.requestId); if (item) item.receivedBodyBytes += event.encodedDataLength })
        session.on('Network.loadingFailed', event => { const item = requests.get(event.requestId); if (item) { item.failed = true; item.canceled = Boolean(event.canceled) } })
        await page.goto(new URL('projects/vae-gan-digits/', url).href, { waitUntil: 'domcontentloaded' })
        await cover(page).waitFor()
        await page.evaluate(() => {
          window.galleryLongTasks = []
          new PerformanceObserver(list => window.galleryLongTasks.push(...list.getEntries().map(entry => ({ at: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask' })
        })
        for (const [action, index] of [['cold-open', 0], ['jump-last', 6], ['return-first', 0], ['warm-open', 0]]) {
          if (action === 'warm-open') { await page.keyboard.press('Escape'); await dialog(page).waitFor({ state: 'detached' }) }
          const prior = new Set(requests.keys())
          const carried = [...requests].filter(([, request]) => !request.complete && !request.failed).map(([id]) => id)
          await page.evaluate(({ action, index }) => {
            const probe = window.galleryTiming = { start: performance.now(), feedback: null, display: null, original: null, maxOriginals: 0, frame: 0 }
            const sample = () => {
              const current = document.querySelector('.yarl__slide_current')
              const selected = current?.getAttribute('aria-label') === `第 ${index + 1} 张，共 7 张`
              const images = [...document.querySelectorAll('.yarl__slide img')]
              const full = images.filter(image => new URL(image.src).pathname.startsWith('/images/projects/'))
              probe.maxOriginals = Math.max(probe.maxOriginals, full.length)
              if (probe.feedback === null && (document.querySelector('[aria-busy="true"]') || selected)) probe.feedback = performance.now() - probe.start
              const image = current?.querySelector('img')
              const bounds = document.querySelector('.gallery-stage')?.getBoundingClientRect()
              const box = image?.getBoundingClientRect()
              const arrived = box && bounds && Math.abs((box.left + box.right - bounds.left - bounds.right) / 2) < 2
              let opacity = 1
              for (let element = image; element; element = element.parentElement) opacity *= Number(getComputedStyle(element).opacity)
              if (selected && image?.complete && image.naturalWidth > 0 && getComputedStyle(image).visibility !== 'hidden' && opacity > .01 && arrived) {
                probe.display ??= performance.now() - probe.start
                if (full.includes(image)) probe.original ??= performance.now() - probe.start
              }
              probe.frame = requestAnimationFrame(sample)
            }
            probe.frame = requestAnimationFrame(sample)
            const selector = action.endsWith('open') ? '.project-reader-cover .project-reader-image-trigger' : `button:not(.yarl__thumbnails_thumbnail_placeholder)[aria-label="第 ${index + 1} 张，共 7 张"]`
            document.querySelector(selector).click()
          }, { action, index })
          await settled(page, index)
          await page.waitForTimeout(600)
          const timing = await page.evaluate(() => {
            const probe = window.galleryTiming
            cancelAnimationFrame(probe.frame)
            return { feedbackMs: probe.feedback, displayMs: probe.display, originalMs: probe.original, sampledAtMs: performance.now() - probe.start,
              maxOriginals: probe.maxOriginals, dom: document.querySelectorAll('.image-gallery *').length,
              longTaskMs: window.galleryLongTasks.filter(entry => entry.at >= probe.start).reduce((sum, entry) => sum + entry.duration, 0),
              images: [...document.querySelectorAll('.yarl__slide img')].map(image => ({ path: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight })) }
          })
          samples.push({ profile: name, run, action, ...timing,
            requests: [...requests].filter(([id]) => !prior.has(id)).map(([, request]) => ({ ...request })),
            carryIn: carried.map(id => ({ ...requests.get(id) })),
          })
          if (run === 1 && action === 'cold-open') {
            await page.screenshot({ path: `node_modules/.cache/gallery-loading/${label}-${name}-open.png` })
            await page.getByRole('button', { name: '放大图片', exact: true }).click()
            await page.waitForTimeout(250)
            await page.screenshot({ path: `node_modules/.cache/gallery-loading/${label}-${name}-zoom.png` })
            await page.getByRole('button', { name: '重置图片缩放' }).click()
            await page.waitForTimeout(250)
          }
        }
        samples.push({ profile: name, run, action: 'image-session', requests: [...requests.values()] })
      } finally { await context.close() }
    }
    console.log(`MEASURED: ${label}, ${name}, 3 cold and warm runs`)
  }
  await writeFile(`node_modules/.cache/gallery-loading/${label}.json`, JSON.stringify({ browser: browser.version(), samples }, null, 2))
  const context = await browser.newContext({ ...contextOptions, viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  try {
    const page = await open(context, url)
    await settled(page, 0)
    await page.waitForTimeout(250)
    await page.screenshot({ path: `node_modules/.cache/gallery-loading/${label}-landscape-open.png` })
    await thumb(page, 3).click()
    await page.waitForFunction(() => document.querySelector('.yarl__carousel').getAnimations().some(animation => animation.playState === 'running'))
    await page.locator('.yarl__carousel').evaluate(element => {
      for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = animation.effect.getTiming().duration / 2 }
    })
    await page.screenshot({ path: `node_modules/.cache/gallery-loading/${label}-landscape-travel.png` })
    await page.locator('.yarl__carousel').evaluate(element => element.getAnimations().forEach(animation => animation.play()))
    await settled(page, 3)
    await page.getByRole('button', { name: '放大图片', exact: true }).click()
    await page.waitForTimeout(250)
    await page.screenshot({ path: `node_modules/.cache/gallery-loading/${label}-landscape-zoom.png` })
  } finally { await context.close() }
}

try {
  await mkdir('node_modules/.cache/gallery-loading', { recursive: true })
  if (process.argv.includes('--measure')) {
    if (process.env.GALLERY_BASELINE_URL) await measure(process.env.GALLERY_BASELINE_URL, 'baseline')
    await measure(baseURL, 'candidate')
    assert.deepEqual(errors, [], 'Measurements produce no unhandled browser errors')
  } else {
    const filter = process.argv.find(value => value.startsWith('--check='))?.slice(8)
    const checks = [checkColdOpen, checkIntermediate, checkRetargeting, checkDistanceBudget, checkRecovery, checkMobileRecovery, checkSpeculation, checkFallbackAndPromotion, checkLifecycle]
    if (filter && !checks.some(check => check.name === filter)) throw new Error('Unknown gallery check')
    for (const check of checks) {
      if (!filter || check.name === filter) await check()
    }
    assert.deepEqual(errors, [], 'No unhandled browser errors')
    await writeFile('node_modules/.cache/gallery-loading/checks.json', JSON.stringify({ results }, null, 2))
    console.log(`${results.length} gallery loading checks passed`)
  }
} catch (error) {
  console.error('Gallery loading checks failed:', error.message)
  process.exitCode = 1
} finally { await browser.close() }
