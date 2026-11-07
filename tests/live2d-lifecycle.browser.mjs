import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { preview } from 'vite'
import sharp from 'sharp'
import { launchRealTabs, openSiblingTab } from './real-browser-tabs.mjs'

const output = 'node_modules/.cache/live2d-lifecycle'
const baseline = process.argv.includes('--baseline')
const realTabs = process.argv.includes('--real-tabs')
const measureOnly = process.argv.includes('--measure')
const visual = process.argv.includes('--visual')
const filter = process.argv.find(arg => arg.startsWith('--filter='))?.slice(9)
const version = baseline ? 'baseline' : 'candidate'
const runs = Number(process.argv.find(arg => arg.startsWith('--runs='))?.split('=')[1] || 1)
const sample = Number(process.argv.find(arg => arg.startsWith('--sample='))?.split('=')[1] || 0)
assert.ok(Number.isSafeInteger(sample) && sample >= 0)
const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))

// Measure owned browser resources without adding diagnostic APIs to production.
function instrument() {
  const blobs = new Set()
  const create = URL.createObjectURL
  const revoke = URL.revokeObjectURL
  URL.createObjectURL = function (value) { const url = create.call(this, value); blobs.add(url); return url }
  URL.revokeObjectURL = function (url) { blobs.delete(url); return revoke.call(this, url) }
  const pending = new Map()
  const request = window.requestAnimationFrame.bind(window)
  const cancel = window.cancelAnimationFrame.bind(window)
  let frames = 0
  window.requestAnimationFrame = callback => {
    const id = request(time => { pending.delete(id); frames++; callback(time) })
    pending.set(id, callback)
    return id
  }
  window.cancelAnimationFrame = id => { pending.delete(id); cancel(id) }
  const resources = { textures: new Map(), buffers: new Map(), programs: new Map(), framebuffers: new Map() }
  let draws = 0
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const [kind, name] of [['textures', 'Texture'], ['buffers', 'Buffer'], ['programs', 'Program'], ['framebuffers', 'Framebuffer']]) {
      const create = prototype[`create${name}`]
      const remove = prototype[`delete${name}`]
      prototype[`create${name}`] = function (...args) { const item = create.apply(this, args); if (item) resources[kind].set(item, this); return item }
      prototype[`delete${name}`] = function (item) { resources[kind].delete(item); return remove.call(this, item) }
    }
    for (const name of ['drawElements', 'drawArrays']) {
      const original = prototype[name]
      prototype[name] = function (...args) { if (this.canvas.closest('.live2d-companion')) draws++; return original.apply(this, args) }
    }
  }
  const listeners = []
  const add = EventTarget.prototype.addEventListener
  const remove = EventTarget.prototype.removeEventListener
  const capture = options => typeof options === 'boolean' ? options : Boolean(options?.capture)
  const relevant = target => target === window || target === document || target instanceof MediaQueryList
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if (relevant(this) && !listeners.some(item => item.target === this && item.type === type && item.callback === callback && item.capture === capture(options))) {
      listeners.push({ target: this, type, callback, capture: capture(options) })
    }
    return add.call(this, type, callback, options)
  }
  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    const index = listeners.findIndex(item => item.target === this && item.type === type && item.callback === callback && item.capture === capture(options))
    if (index >= 0) listeners.splice(index, 1)
    return remove.call(this, type, callback, options)
  }
  const events = []
  document.addEventListener('visibilitychange', event => events.push({ hidden: document.hidden, trusted: event.isTrusted }))
  window.__lifecycle = { read: () => {
    // Context destruction releases its allocations even if a library omits individual deletes.
    for (const values of Object.values(resources)) for (const [item, gl] of values) if (gl.isContextLost()) values.delete(item)
    return ({ blobs: blobs.size, frames, pending: pending.size, draws,
    ...Object.fromEntries(Object.entries(resources).map(([key, values]) => [key, values.size])),
    listeners: listeners.length, canvases: document.querySelectorAll('.live2d-companion canvas').length,
    coreScripts: document.querySelectorAll('script[src*="live2dcubismcore"]').length, events }) } }
}
const read = page => page.evaluate(() => window.__lifecycle.read())
const ready = page => page.locator('.live2d-companion canvas.is-ready').waitFor({ timeout: 45000 })
const open = page => page.getByRole('button', { name: '展开看板娘', exact: true }).click()
const close = page => page.locator('[aria-label="收起看板娘"]').evaluate(button => button.click())
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const samples = []
const checks = []
let browser, tabs, server
try {
  await mkdir(output, { recursive: true })
  server = await preview({ configFile: false, build: { outDir: process.argv.includes('--integrated') ? 'dist' : `${output}/${version}` }, preview: { host: '127.0.0.1', port: 4197, strictPort: true } })
  const baseURL = 'http://127.0.0.1:4197'
  const channel = process.env.COMPANION_BROWSER_CHANNEL || 'msedge'
  if (realTabs) tabs = await launchRealTabs(chromium, channel)
  browser = tabs?.browser ?? await chromium.launch({ channel, headless: true })
  const scenario = async (name, test, options = {}) => {
    if (filter && !name.includes(filter)) return
    const context = tabs?.context ?? await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options })
    await context.addInitScript(instrument)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await test(page, context)
      assert.deepEqual(errors, [], name)
      checks.push(name)
      console.log(`PASS: ${name}`)
    } finally {
      if (realTabs) await Promise.all(context.pages().map(page => page.close()))
      else await context.close()
    }
  }
  const cpu = async (page, label) => {
    const session = await page.context().newCDPSession(page)
    await session.send('Performance.enable')
    const task = async () => (await session.send('Performance.getMetrics')).metrics.find(item => item.name === 'TaskDuration').value
    const before = await read(page), taskBefore = await task()
    await delay(2000)
    const after = await read(page)
    const sample = { version, label, taskMs: (await task() - taskBefore) * 1000, frames: after.frames - before.frames,
      draws: after.draws - before.draws, pending: after.pending }
    samples.push(sample)
    await session.detach()
    return sample
  }
  if (realTabs) {
    await scenario('trusted tab visibility stops rendering and restores current motion preference', async page => {
      await page.bringToFront()
      await page.goto(`${baseURL}/contact/`)
      await page.waitForFunction(() => !document.hidden, undefined, { polling: 100, timeout: 5000 })
      await page.getByRole('button', { name: '展开看板娘', exact: true }).press('Enter')
      await ready(page)
      await cpu(page, 'visible')
      const original = await page.locator('.live2d-companion canvas').elementHandle()
      const other = await openSiblingTab(page)
      await page.waitForFunction(() => document.hidden, undefined, { polling: 100 })
      await delay(300)
      const hidden = await cpu(page, 'hidden')
      assert.equal(hidden.draws, 0); if (!baseline) assert.equal(hidden.pending, 0)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.bringToFront()
      await page.waitForFunction(() => !document.hidden)
      await delay(200)
      const reduced = await cpu(page, 'reduced')
      assert.equal(reduced.draws, 0); if (!baseline) assert.equal(reduced.pending, 0)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      const restored = await cpu(page, 'restored')
      assert.ok(restored.draws > 0)
      assert.equal(await original.evaluate(canvas => canvas === document.querySelector('.live2d-companion canvas')), true)
      const events = (await read(page)).events
      assert.ok(events.some(event => event.hidden && event.trusted))
      assert.ok(events.some(event => !event.hidden && event.trusted))
      await close(page)
      await page.evaluate(() => sessionStorage.setItem('site-live2d-collapsed-desktop', 'false'))
      let starts = 0
      page.on('request', request => { if (/live2d|pixi|cubism|display-/.test(request.url())) starts++ })
      await other.bringToFront()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('.live2d-stage').waitFor({ state: 'attached' })
      assert.equal(await page.evaluate(() => document.hidden), true)
      await delay(1800)
      samples.push({ version, label: 'remembered-hidden-start', requests: starts })
      if (!baseline) assert.equal(starts, 0, 'Remembered expansion waits for actual foreground visibility')
      await page.bringToFront()
      await page.waitForFunction(() => !document.hidden, undefined, { polling: 100, timeout: 5000 })
      try { await ready(page) } catch (error) {
        samples.push(await page.evaluate(() => ({ label: 'restore-diagnostics', hidden: document.hidden, events: window.__lifecycle.read().events,
          status: document.querySelector('.live2d-stage')?.dataset.loadStatus, stage: document.querySelector('.live2d-stage')?.dataset.loadStage,
          notice: document.querySelector('.live2d-placeholder p')?.textContent, pageContent: document.querySelector('main')?.firstElementChild?.className,
          requests: performance.getEntriesByType('resource').filter(entry => /live2d|pixi|cubism|display-/.test(entry.name)).map(entry => new URL(entry.name).pathname) })))
        throw error
      }
      assert.equal((await read(page)).canvases, 1)
    })
  } else if (visual) {
    for (const [label, width, height, dpr] of [['desktop', 1440, 900, 1], ['mobile', 390, 844, 3], ['landscape', 844, 390, 3]]) {
      await scenario(`static expanded artwork and controls at ${label}`, async page => {
        await page.goto(`${baseURL}/contact/`)
        await open(page); await ready(page)
        await page.locator('.live2d-canvas-wrap').focus()
        await page.evaluate(() => document.fonts.ready)
        await delay(450)
        const stage = await page.locator('.live2d-stage').boundingBox()
        const x = Math.max(0, Math.floor(stage.x) - 80), y = Math.max(0, Math.floor(stage.y) - 16)
        const file = `${output}/${version}-${label}.png`
        const png = await page.screenshot({ clip: { x, y, width: width - x, height: height - y }, path: file })
        if (!baseline) {
          const before = await sharp(`${output}/baseline-${label}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true })
          const after = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
          assert.deepEqual(after.info, before.info)
          let different = 0
          for (let i = 0; i < after.data.length; i += 3) {
            if ([0, 1, 2].some(channel => Math.abs(after.data[i + channel] - before.data[i + channel]) > 8)) different++
          }
          const fraction = different / (after.info.width * after.info.height)
          samples.push({ label, width: after.info.width, height: after.info.height, different, fraction })
          assert.ok(fraction < .005, `${label}: ${(100 * fraction).toFixed(2)}% of pixels differ by more than 8`)
        }
      }, { viewport: { width, height }, deviceScaleFactor: dpr, isMobile: dpr > 1, hasTouch: dpr > 1, reducedMotion: 'reduce' })
    }
  } else {
    for (let run = 0; run < (process.argv.includes('--checks') ? 0 : runs); run++) for (const mobile of [false, true]) {
      await scenario(`first explicit expansion ${mobile ? 'mobile' : 'desktop'} ${run + 1}`, async (page, context) => {
        const session = await context.newCDPSession(page)
        const relevant = url => /\/live2d\/vampire\/|\/live2dcubismcore\.min\.js|\/assets\/(?:live2d|pixi|cubism4\.es|display)-/.test(url)
        const net = new Map()
        session.on('Network.requestWillBeSent', event => {
          if (relevant(event.request.url)) net.set(event.requestId, { path: new URL(event.request.url).pathname, bytes: null })
        })
        session.on('Network.loadingFinished', event => { const record = net.get(event.requestId); if (record) record.bytes = event.encodedDataLength })
        await session.send('Network.enable')
        await session.send('Network.setCacheDisabled', { cacheDisabled: true })
        await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: .75e6 / 8 })
        await session.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 })
        await page.goto(`${baseURL}/contact/`)
        await page.getByRole('button', { name: '展开看板娘' }).waitFor()
        assert.equal(net.size, 0, 'No companion resources while collapsed')
        await page.evaluate(() => {
          window.__firstPose = new Promise(resolve => document.querySelector('.live2d-launcher').addEventListener('click', () => {
            const start = performance.now()
            const observer = new MutationObserver(() => {
              const canvas = document.querySelector('.live2d-companion canvas.is-ready')
              if (!canvas) return
              observer.disconnect()
              const visibleFrame = () => Number(getComputedStyle(canvas).opacity) > 0 ? resolve(performance.now() - start) : requestAnimationFrame(visibleFrame)
              requestAnimationFrame(visibleFrame)
            })
            observer.observe(document.querySelector('.live2d-companion'), { subtree: true, attributes: true, childList: true })
          }, { capture: true, once: true }))
        })
        await open(page); await ready(page)
        const elapsed = Math.round(await page.evaluate(() => window.__firstPose))
        const requests = [...net.values()]
        assert.ok(requests.every(item => item.bytes !== null))
        assert.equal(new Set(requests.map(item => item.path)).size, requests.length)
        samples.push({ version, profile: mobile ? 'mobile' : 'desktop', run, readyMs: elapsed, requests })
        console.log(`OBSERVE: ${elapsed} ms, ${requests.length} requests`)
        await close(page)
      }, mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {})
    }
    if (!measureOnly) {
      await scenario('20 open/close cycles release blobs, WebGL resources and listeners', async page => {
        await page.goto(`${baseURL}/contact/`)
        let reference, last
        for (let cycle = 0; cycle < 20; cycle++) {
          await open(page); await ready(page); await close(page); await delay(150)
          const state = last = await read(page)
          for (const key of ['blobs', 'canvases', 'pending', 'textures', 'buffers', 'programs', 'framebuffers']) {
            assert.equal(state[key], 0, `${key} remains after close ${cycle + 1}`)
          }
          if (!reference) reference = state
          else assert.equal(state.listeners, reference.listeners, `Global listeners grew after close ${cycle + 1}`)
          if (!baseline) assert.equal(state.coreScripts, 0)
        }
        samples.push({ version, label: 'released-after-20', first: reference, last })
      })
      await scenario('route exit destroys the scene and returning restores the saved preference', async page => {
        await page.goto(`${baseURL}/contact/`)
        await open(page); await ready(page)
        const before = await read(page)
        await page.locator('a[href="/projects/"]:visible').first().click()
        await page.waitForURL('**/projects/')
        await page.waitForFunction(() => !document.querySelector('.live2d-companion'))
        const after = await read(page)
        assert.equal(after.blobs, 0); assert.equal(after.canvases, 0)
        assert.ok(after.textures < before.textures)
        await page.goBack(); await ready(page)
        assert.equal((await read(page)).canvases, 1)
      })
      await scenario('rapid cold reopen shares the pending Core script and discards old scene work', async page => {
        let release
        const held = new Promise(resolve => { release = resolve })
        let requests = 0
        await page.route('https://cubism.live2d.com/**', async route => { requests++; await held; await route.continue() })
        await page.goto(`${baseURL}/contact/`)
        const started = page.waitForRequest('https://cubism.live2d.com/**')
        await open(page)
        await started
        await close(page); await delay(200)
        const state = await read(page)
        assert.equal(state.blobs, 0); assert.equal(state.canvases, 0)
        await open(page); release(); await ready(page)
        assert.equal(requests, 1)
        assert.equal((await read(page)).canvases, 1)
        if (!baseline) assert.equal((await read(page)).coreScripts, 0)
      })
      await scenario('loading cancellation aborts model fetch and ignores its late completion', async page => {
        let release
        const held = new Promise(resolve => { release = resolve })
        await page.route('**/model.model3.json', async route => { await held; await route.abort().catch(() => {}) })
        await page.goto(`${baseURL}/contact/`)
        const started = page.waitForRequest('**/model.model3.json')
        await open(page)
        await started
        await close(page); release(); await delay(250)
        const state = await read(page)
        assert.equal(state.blobs, 0); assert.equal(state.canvases, 0)
      })
      await scenario('leaving during a held fetch aborts the old route and restores a fresh scene on return', async page => {
        await page.addInitScript(() => {
          const fetchResource = window.fetch
          window.fetch = (input, options) => {
            if (String(input).endsWith('/model.model3.json')) options?.signal?.addEventListener('abort', () => { window.__modelAborted = true }, { once: true })
            return fetchResource(input, options)
          }
        })
        let release
        const held = new Promise(resolve => { release = resolve })
        await page.route('**/model.model3.json', async route => { await held; await route.continue().catch(() => {}) }, { times: 1 })
        await page.goto(`${baseURL}/contact/`)
        const started = page.waitForRequest('**/model.model3.json')
        await open(page); await started
        await page.locator('a[href="/projects/"]:visible').first().click(); await page.waitForURL('**/projects/')
        await page.waitForFunction(() => window.__modelAborted && !document.querySelector('.live2d-companion'))
        release(); await delay(200)
        const state = await read(page)
        assert.equal(state.blobs, 0); assert.equal(state.canvases, 0)
        await page.goBack(); await ready(page)
        assert.equal((await read(page)).canvases, 1)
      })
      if (!baseline) await scenario('remembered expansion waits for the page module and skips the entrance on restore', async page => {
        await page.addInitScript(() => {
          sessionStorage.setItem('site-live2d-collapsed-desktop', 'false')
          // Exercise the bounded task fallback independently of Chromium's idle API.
          Object.defineProperty(window, 'requestIdleCallback', { value: undefined, configurable: true })
        })
        const companionRequests = []
        page.on('request', request => { if (/live2d|pixi|cubism|display-/.test(request.url())) companionRequests.push(request.url()) })
        let release
        const held = new Promise(resolve => { release = resolve })
        await page.route('**/ContactPage-*.js', async route => { await held; await route.continue() })
        try {
          await page.goto(`${baseURL}/contact/`, { waitUntil: 'commit' })
          await page.locator('[data-load-status="waiting"]').waitFor(); await delay(1200)
          assert.equal(companionRequests.length, 0)
        } finally { release() }
        await ready(page)
        assert.ok(companionRequests.every(url => !url.includes('/home.motion3.json')))
      })
      await scenario('explicit expansion starts before a held route module completes', async page => {
        let release
        const held = new Promise(resolve => { release = resolve })
        await page.route('**/ContactPage-*.js', async route => { await held; await route.continue() })
        try {
          await page.goto(`${baseURL}/contact/`, { waitUntil: 'commit' })
          const started = page.waitForRequest('**/model.model3.json', { timeout: 5000 })
          await Promise.all([started, open(page)])
        } finally { release() }
        await ready(page)
      })
      await scenario('permanent resource failure stops and manual keyboard retry recovers', async page => {
        let requests = 0, fail = true
        await page.route('**/textures/texture_00.webp', route => {
          requests++
          return fail ? route.fulfill({ status: 404, body: '' }) : route.continue()
        })
        await page.goto(`${baseURL}/contact/`)
        await open(page)
        await page.locator('[data-load-status="error"]').waitFor()
        assert.equal(requests, 1); assert.equal((await read(page)).blobs, 0)
        fail = false
        await page.getByRole('button', { name: '再试一次' }).press('Enter'); await ready(page)
        assert.equal(requests, 2)
        await page.waitForFunction(() => document.activeElement?.classList.contains('live2d-canvas-wrap'))
      })
      await scenario('transient network failure retries and offline ready scene remains intact', async (page, context) => {
        let requests = 0
        await page.route('**/model.model3.json', route => ++requests === 1 ? route.fulfill({ status: 503, body: '' }) : route.continue())
        await page.goto(`${baseURL}/contact/`)
        await open(page); await ready(page)
        assert.equal(requests, 2)
        const canvas = await page.locator('.live2d-companion canvas').elementHandle()
        await context.setOffline(true); await delay(200)
        assert.equal(await canvas.evaluate(node => node.classList.contains('is-ready')), true)
        await context.setOffline(false)
        assert.equal(requests, 2)
      })
      await scenario('WebGL recovery is bounded and releases each replaced scene', async page => {
        await page.goto(`${baseURL}/contact/`)
        await open(page); await ready(page)
        for (let index = 0; index < 3; index++) {
          await page.evaluate(() => {
            const canvas = document.querySelector('.live2d-companion canvas')
            window.__previousCanvas = canvas
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
            window.__loss = gl.getExtension('WEBGL_lose_context')
            window.__loss.loseContext()
          })
          if (index === 2) { await page.locator('[data-load-status="error"]').waitFor(); break }
          await page.locator('[data-load-status="recovering"]').waitFor()
          await page.evaluate(() => window.__loss.restoreContext()); await ready(page)
          assert.equal(await page.evaluate(() => document.querySelector('.live2d-companion canvas') !== window.__previousCanvas), true)
          assert.equal((await read(page)).canvases, 1)
          assert.equal(await page.locator('.live2d-dialogue').innerText(), '')
        }
        await close(page)
        assert.equal((await read(page)).blobs, 0)
      })
    }
  }
} catch (error) {
  console.error('Live2D verification failed:', error.message.replace(/[A-Za-z]:[\\/][^\n]+|\/(?:Users|home|tmp|var|opt)\/[^\n]+/g, '<local-path>'))
  process.exitCode = 1
} finally {
  const mode = realTabs ? 'tabs' : visual ? 'visual' : measureOnly ? 'measure' : 'checks'
  const selection = filter ? `-${filter.replace(/[^a-z0-9]+/gi, '-')}` : ''
  await writeFile(`${output}/${version}-${mode}${process.argv.includes('--integrated') ? '-integrated' : ''}${selection}${sample ? `-${sample}` : ''}.json`, JSON.stringify({ browser: browser?.version(), passed: !process.exitCode, checks, samples }, null, 2))
  if (tabs) await tabs.close()
  else await browser?.close()
  if (server) await new Promise(resolve => server.httpServer.close(resolve))
}
