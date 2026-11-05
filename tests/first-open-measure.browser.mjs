import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { connectionState } from './page-resources.browser.mjs'

const options = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')))
const runs = Number(options.get('runs') || 3)
const output = 'node_modules/.cache/first-open'
const label = options.get('output') || 'acceptance'
assert.match(label, /^[a-z0-9-]+$/i)
const versions = [
  ['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/'],
  ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'],
].filter(([name]) => !options.has('version') || options.get('version') === name)
const profiles = [
  { name: 'desktop-network', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mbps: 10, latency: 50 },
  { name: 'desktop-weak', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mbps: 1.6, latency: 150 },
  { name: 'mobile-weak', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4, mbps: 1.6, latency: 150 },
].filter(({ name }) => !options.has('profile') || options.get('profile') === name)
const scenarios = ['menu', 'reader', 'gallery'].filter(name => !options.has('scenario') || options.get('scenario').split(',').includes(name))

function sampler() {
  const tasks = []
  const decoded = new WeakMap()
  new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))))
    .observe({ type: 'longtask', buffered: true })
  window.__openSamples = []
  window.__measureOpen = (trigger, surface, kind) => {
    document.querySelector(trigger).focus({ preventScroll: true })
    const result = { kind, start: performance.now(), feedback: null, ready: null, fonts: null, images: null }
    window.__openSamples.push(result)
    const visible = el => {
      if (!el || !el.getClientRects().length) return false
      const box = el.getBoundingClientRect()
      if (box.right <= 0 || box.left >= innerWidth || box.bottom <= 0 || box.top >= innerHeight) return false
      for (let node = el; node instanceof HTMLElement; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.visibility === 'hidden' || Number(style.opacity) < .01) return false
      }
      return true
    }
    const tick = () => {
      const el = document.querySelector(surface)
      const elapsed = performance.now() - result.start
      if (visible(el)) {
        result.feedback ??= elapsed
        if (result.ready === null) {
          const animating = el.getAnimations({ subtree: true }).some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)
          const constructed = kind === 'reader' ? el.querySelector('#home-now-reader-title')
            : kind === 'gallery' ? !el.querySelector('.gallery-opening') : kind === 'main-menu' ? el.querySelector('.mobile-nav-list') : true
          if (constructed && !animating && (!el.matches('.home-now-reader') || el.dataset.phase === 'open')) result.ready = elapsed
        }
        if (result.images === null && kind !== 'main-menu') {
          const selector = kind === 'reader' ? '.home-now-reader-scene img'
            : kind === 'gallery' ? '.yarl__slide_current .gallery-original' : 'img'
          const images = [...el.querySelectorAll(selector)].filter(visible)
          for (const img of images) {
            const path = img.currentSrc
            if (img.complete && img.naturalWidth > 0 && decoded.get(img) !== path && decoded.get(img) !== `pending:${path}`) {
              decoded.set(img, `pending:${path}`)
              void img.decode().then(() => decoded.set(img, path), () => decoded.delete(img))
            }
          }
          if (images.length && images.every(img => img.currentSrc && decoded.get(img) === img.currentSrc)) result.images = elapsed
        }
        if (kind === 'reader' && result.fonts === null && el.querySelector('.home-now-live-content')?.getAttribute('aria-busy') === 'false'
          && document.fonts.check('18px "Woodland WenKai"', el.textContent)
          && document.fonts.check('48px "Woodland Display"', 'NOW & NOTES')) result.fonts ??= elapsed
      }
      if (elapsed < 16000 && !result.end && result === window.__openSamples.at(-1)
        && (result.feedback === null || result.ready === null || (kind !== 'main-menu' && result.images === null) || (kind === 'reader' && result.fonts === null))) requestAnimationFrame(tick)
    }
    document.querySelector(trigger).click()
    requestAnimationFrame(tick)
  }
  window.__readOpen = () => window.__openSamples.map(result => {
    const end = performance.now()
    // Include the task that dispatched click: the mark can lie inside it.
    const selected = tasks.filter(t => t.start + t.duration > result.start && t.start < (result.end || end))
    return { ...result, sampledAt: (result.end || end) - result.start,
      longTaskMs: selected.reduce((s, t) => s + t.duration, 0),
      blockingMs: selected.reduce((s, t) => s + Math.max(0, t.duration - 50), 0),
      maxTaskMs: Math.max(0, ...selected.map(t => t.duration)) }
  })
}

function networkRecorder(cdp) {
  const requests = new Map()
  let phase = 'startup'
  cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId, {
    phase, path: new URL(e.request.url).pathname, type: e.type, priority: e.request.initialPriority,
    bytes: 0, partial: 0, done: false, failed: false, cached: false, status: null,
  }))
  cdp.on('Network.responseReceived', e => { const item = requests.get(e.requestId); if (item) item.status = e.response.status })
  cdp.on('Network.dataReceived', e => { const item = requests.get(e.requestId); if (item) item.partial += e.encodedDataLength })
  cdp.on('Network.requestServedFromCache', e => { const item = requests.get(e.requestId); if (item) item.cached = true })
  cdp.on('Network.loadingFinished', e => { const item = requests.get(e.requestId); if (item) { item.done = true; item.bytes = e.encodedDataLength } })
  cdp.on('Network.loadingFailed', e => { const item = requests.get(e.requestId); if (item) item.failed = true })
  return { reset: () => requests.clear(), phase: value => { phase = value }, read: () => {
    const list = [...requests.values()]
    return { list, bytes: list.reduce((s, r) => s + r.bytes, 0), fontBytes: list.filter(r => r.type === 'Font').reduce((s, r) => s + r.bytes, 0),
      pending: list.filter(r => !r.done && !r.failed).length, pendingBytes: list.filter(r => !r.done).reduce((s, r) => s + r.partial, 0) }
  } }
}

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || 'msedge', headless: true, args: ['--force-effective-connection-type=3G'] })
const samples = []
const methodVersion = 3
try {
  await mkdir(output, { recursive: true })
  if (versions.length === 2) for (const file of ['github.json', 'rss.json']) {
    const bodies = await Promise.all(versions.map(async ([, base]) => (await fetch(new URL(`data/${file}`, base))).text()))
    assert.equal(bodies[0], bodies[1], 'Baseline and candidate must use identical content snapshots')
  }
  if (options.has('resume')) {
    const previous = JSON.parse(await readFile(`${output}/${label}.json`, 'utf8'))
    assert.equal(previous.methodVersion, methodVersion)
    assert.equal(previous.browser, browser.version())
    samples.push(...previous.samples)
  }
  for (const [version, base] of versions) for (const profile of profiles) for (const scenario of scenarios) for (let run = 1; run <= runs; run++) {
    if (samples.some(s => s.version === version && s.profile === profile.name && s.scenario === scenario && s.run === run && s.cache === 'warm')) continue
    const { name, cpu, mbps, latency, ...settings } = profile
    const context = await browser.newContext({ ...settings, serviceWorkers: 'block', reducedMotion: 'no-preference' })
    await context.addInitScript(connectionState, { effectiveType: '4g', downlink: mbps, rtt: latency, saveData: false })
    await context.addInitScript(sampler)
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency,
      downloadThroughput: mbps * 1_000_000 / 8, uploadThroughput: 750_000 / 8 }] })
    const network = networkRecorder(cdp)
    try {
      for (const cache of options.has('trace') && !options.has('warm') ? ['cold'] : ['cold', 'warm']) {
        network.reset()
        network.phase('startup')
        if (cache === 'cold') await page.goto(new URL(scenario === 'gallery' ? 'projects/vae-gan-digits/' : 'home/', base).href, { waitUntil: 'domcontentloaded' })
        else await page.reload({ waitUntil: 'domcontentloaded' })
        await page.locator(scenario === 'gallery' ? '.project-reader-cover' : '.home-editorial').waitFor()
        await page.waitForTimeout(500)
        const mounted = await page.evaluate(() => performance.now())
        const before = network.read()
        if (scenario === 'reader') {
          await page.evaluate(() => document.querySelector('#now .home-gallery').scrollIntoView({ block: 'center', behavior: 'instant' }))
          await page.waitForTimeout(100)
        }
        const trace = []
        if (options.has('trace')) {
          cdp.on('Tracing.dataCollected', e => trace.push(...e.value))
          await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.stack', transferMode: 'ReportEvents' })
          await cdp.send('Profiler.enable')
          await cdp.send('Profiler.start')
        }
        const open = async (repeated = false) => {
          network.phase(repeated ? 'reopen' : 'interaction')
          if (scenario === 'menu' && profile.isMobile) {
            await page.evaluate(() => window.__measureOpen('.nav-menu-button', '.mobile-nav-body', 'main-menu'))
            await page.waitForTimeout(650)
            await page.evaluate(() => { window.__openSamples.at(-1).end = performance.now(); window.__measureOpen('#mobile-nav-toggle-projects', '.mobile-nav-panel.is-active', 'menu') })
          } else await page.evaluate(scenario => {
            const args = scenario === 'reader' ? ['#now .home-gallery-open', '.home-now-reader[open]', 'reader']
              : scenario === 'gallery' ? ['.project-reader-cover .project-reader-image-trigger', '.yarl__root', 'gallery']
                : ['#nav-toggle-projects', '#nav-panel-projects:not([hidden])', 'menu']
            window.__measureOpen(...args)
          }, scenario)
        }
        await open()
        await page.waitForTimeout(options.has('trace') ? 1500 : scenario === 'reader' ? 15000 : 3000)
        const first = await page.evaluate(() => { window.__openSamples.at(-1).end = performance.now(); return window.__readOpen() })
        if (options.has('trace')) {
          const cpuProfile = (await cdp.send('Profiler.stop')).profile
          const end = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve))
          await cdp.send('Tracing.end')
          await end
          const summary = ['Layout', 'UpdateLayoutTree', 'Paint', 'FunctionCall', 'EventDispatch'].map(event => ({ event,
            count: trace.filter(e => e.name === event).length,
            ms: trace.filter(e => e.name === event).reduce((sum, e) => sum + (e.dur || 0) / 1000, 0) }))
          // Keep CPU function identifiers, but omit local script URLs from diagnostics.
          for (const node of cpuProfile.nodes) node.callFrame.url = node.callFrame.url.startsWith('http') ? new URL(node.callFrame.url).pathname : ''
          await writeFile(`${output}/trace-${version}-${name}-${scenario}.json`, JSON.stringify({ summary, cpuProfile,
            layouts: trace.filter(e => e.name === 'Layout' || e.name === 'UpdateLayoutTree').map(e => ({ name: e.name, dur: e.dur, args: e.args })) }, null, 2))
          console.log(JSON.stringify({ scenario, trace: summary }))
        }
        const after = network.read()
        await page.keyboard.press('Escape')
        await page.waitForTimeout(750)
        await open(true)
        await page.waitForTimeout(1500)
        const repeated = (await page.evaluate(() => window.__readOpen())).slice(first.length)
        assert.deepEqual(errors, [])
        assert.ok(first.every(s => s.feedback !== null), 'The first interaction must show a visible surface')
        assert.ok(repeated.every(s => s.feedback !== null), 'Reopening must show a visible surface')
        const sample = { version, profile: name, scenario, run, cache, mounted, before, after, reopened: network.read(), first, repeated }
        samples.push(sample)
        console.log(JSON.stringify({ version, profile: name, scenario, run, cache,
          first: first.map(({ kind, feedback, ready, fonts, images, longTaskMs }) => ({ kind, feedback, ready, fonts, images, longTaskMs })),
          repeated: repeated.map(({ kind, feedback }) => ({ kind, feedback })), KiB: Math.round(after.bytes / 102.4) / 10, pending: after.pending }))
        await writeFile(`${output}/${label}.json`, JSON.stringify({ methodVersion, browser: browser.version(), runs, samples }, null, 2))
      }
    } finally { await context.close() }
  }
} catch (error) { console.error(`First-open measurement failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
