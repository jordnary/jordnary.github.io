import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { connectionState } from './page-resources.browser.mjs'

const options = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')))
const runs = Number(options.get('runs') || 3)
const ect = options.get('ect') || '3G'
const output = 'node_modules/.cache/inpage-images'
const outputName = options.get('output') || ect
assert.match(outputName, /^[a-z0-9-]+$/i)
assert.ok(Number.isInteger(runs) && runs > 0, 'Runs must be a positive integer')
const methodVersion = 2
const versions = [
  ['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/'],
  ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'],
].filter(([version]) => !options.has('version') || version === options.get('version'))
const profiles = [
  { name: 'desktop-network', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mbps: 10, latency: 50 },
  { name: 'desktop-weak', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mbps: 1.6, latency: 150 },
  { name: 'mobile-weak', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4, mbps: 1.6, latency: 150 },
].filter(profile => !options.has('profile') || profile.name === options.get('profile'))
const scenarios = ['idle', 'scroll', 'jump', 'reader', 'menu'].filter(name => !options.has('scenario') || options.get('scenario').split(',').includes(name))

function installImageSampler() {
  const entries = new Map()
  const intersecting = new Set()
  const observed = new WeakSet()
  const decoded = new WeakMap()
  const longTasks = []
  new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))))
    .observe({ type: 'longtask', buffered: true })
  const observer = new IntersectionObserver(items => items.forEach(item => {
    if (item.isIntersecting && item.intersectionRatio > 0) intersecting.add(item.target)
    else intersecting.delete(item.target)
  }))
  let phase = 'cold'
  let start = 0
  let feedback = null
  const observe = () => document.querySelectorAll('.home-gallery img, .nav-photo-frame img, .home-now-reader-scene img, .home-now-reader-cover img, .github-repository-ornament img').forEach(image => {
    if (!observed.has(image)) { observed.add(image); observer.observe(image) }
  })
  new MutationObserver(observe).observe(document, { childList: true, subtree: true })
  window.__beginImages = name => { phase = name; start = performance.now(); entries.clear(); feedback = null }
  window.__readImages = () => ({ duration: performance.now() - start, feedback,
    fontsLoaded: document.fonts.status === 'loaded', images: [...entries.values()],
    elements: document.getElementsByTagName('*').length,
    longTaskMs: longTasks.filter(entry => entry.start >= start).reduce((sum, entry) => sum + entry.duration, 0),
    blockingMs: longTasks.filter(entry => entry.start >= start).reduce((sum, entry) => sum + Math.max(0, entry.duration - 50), 0) })
  let lastFrame = 0
  const tick = () => {
    const now = performance.now()
    const elapsed = lastFrame ? now - lastFrame : 0
    lastFrame = now
    if (feedback === null && (phase === 'menu' ? document.querySelector('.nav-mega-panel:not([hidden]),.mobile-nav-panel.is-active')
      : phase === 'reader' ? document.querySelector('.home-now-reader[open]') : null)) feedback = performance.now() - start
    for (const image of intersecting) {
      if (!image.isConnected || !image.getClientRects().length) continue
      const dialog = document.querySelector('dialog[open]')
      if (dialog && !dialog.contains(image)) continue
      let visible = true
      for (let node = image; node instanceof HTMLElement; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < .01 || node.hidden) { visible = false; break }
      }
      if (!visible) continue
      const key = image.closest('.home-now-reader-scene') ? 'reader-frame'
        : image.closest('.home-now-reader-cover') ? 'reader-cover'
          : image.closest('.github-repository-ornament') ? 'reader-ornament' : image.alt
      const item = entries.get(key) ?? { key, visible: now, ready: null, wait: 0 }
      const path = image.currentSrc ? new URL(image.currentSrc).pathname : ''
      item.path = path
      const rect = image.getBoundingClientRect()
      item.width = rect.width
      item.height = rect.height
      if (image.complete && image.naturalWidth && path) {
        if (decoded.get(image) === path) item.ready ??= performance.now()
        else if (decoded.get(image) !== `pending:${path}`) {
          decoded.set(image, `pending:${path}`)
          void image.decode().then(() => decoded.set(image, path), () => decoded.delete(image))
        }
      }
      if (item.ready === null) item.wait += elapsed
      entries.set(key, item)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function networkRecorder(cdp) {
  const requests = new Map()
  let phase = 'cold'
  cdp.on('Network.requestWillBeSent', event => requests.set(event.requestId, {
    phase, path: new URL(event.request.url).pathname, type: event.type,
    priority: event.request.initialPriority, bytes: 0, partial: 0, done: false, failed: false, cached: false,
  }))
  cdp.on('Network.dataReceived', event => { const item = requests.get(event.requestId); if (item) item.partial += event.encodedDataLength })
  cdp.on('Network.requestServedFromCache', event => { const item = requests.get(event.requestId); if (item) item.cached = true })
  cdp.on('Network.loadingFinished', event => { const item = requests.get(event.requestId); if (item) { item.done = true; item.bytes = event.encodedDataLength } })
  cdp.on('Network.loadingFailed', event => { const item = requests.get(event.requestId); if (item) item.failed = true })
  return { phase: value => { phase = value }, read: () => {
    const list = [...requests.values()]
    return { list, wireBytes: list.reduce((sum, item) => sum + item.bytes, 0),
      pendingBytes: list.filter(item => !item.done).reduce((sum, item) => sum + item.partial, 0),
      pending: list.filter(item => !item.done && !item.failed).length }
  } }
}

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || 'msedge', headless: true,
  args: [`--force-effective-connection-type=${ect}`] })
const samples = []
try {
  await mkdir(output, { recursive: true })
  if (versions.length > 1) for (const file of ['github.json', 'rss.json']) {
    const snapshots = await Promise.all(versions.map(async ([, base]) => {
      const response = await fetch(new URL(`data/${file}`, base))
      assert.ok(response.ok, `The ${file} fixture must be available`)
      return response.text()
    }))
    assert.ok(snapshots.every(value => value === snapshots[0]), `Use identical ${file} fixtures for both versions`)
  }
  if (options.has('resume')) {
    const previous = JSON.parse(await readFile(`${output}/measure-${outputName}.json`, 'utf8'))
    assert.equal(previous.methodVersion, methodVersion, 'Resume requires the same measurement method')
    assert.equal(previous.browser, browser.version(), 'Resume requires the same browser version')
    assert.equal(previous.ect, ect)
    assert.equal(previous.runs, runs)
    samples.push(...previous.samples)
  }
  for (const [version, base] of versions) for (const profile of profiles) for (const scenario of scenarios) {
    for (let run = 1; run <= runs; run++) {
      if (samples.some(sample => sample.version === version && sample.profile === profile.name && sample.scenario === scenario && sample.run === run)) continue
      const { name, cpu, mbps, latency, ...settings } = profile
      const context = await browser.newContext({ ...settings, serviceWorkers: 'block', reducedMotion: 'no-preference' })
      await context.addInitScript(connectionState, { effectiveType: '4g', downlink: mbps, rtt: latency, saveData: false })
      await context.addInitScript(installImageSampler)
      if (options.has('visible-only') && version === 'candidate') await context.addInitScript(() => {
        const Native = window.IntersectionObserver
        window.IntersectionObserver = class extends Native {
          constructor(callback, settings) { super(callback, /^(1400|2100)px 0px$/.test(settings?.rootMargin) ? { ...settings, rootMargin: '0px' } : settings) }
        }
      })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
      // Transport throttling without mutating the independently controlled native
      // lazy-load ECT. JS policy estimates cannot control Chromium's lazy radius.
      await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '',
        latency, downloadThroughput: mbps * 1_000_000 / 8, uploadThroughput: 750_000 / 8 }] })
      const network = networkRecorder(cdp)
      try {
        await page.goto(new URL('home/', base).href, { waitUntil: 'domcontentloaded' })
        await page.locator('.home-editorial').waitFor()
        await page.waitForTimeout(500)
        const before = network.read()
        network.phase(scenario)
        await page.evaluate(name => window.__beginImages(name), scenario)
        const started = await page.evaluate(() => performance.now())
        if (scenario === 'scroll') {
          await page.evaluate(async () => {
            const scroller = matchMedia('(pointer: coarse)').matches ? document.getElementById('site-scroll') : null
            const current = scroller?.scrollTop ?? scrollY
            const rootTop = scroller?.getBoundingClientRect().top ?? 0
            const target = document.querySelector('#now .home-gallery').getBoundingClientRect().top + current - rootTop - 200
            const start = performance.now()
            await new Promise(resolve => {
              const scroll = () => {
                const y = Math.min(target, current + (performance.now() - start) * .9)
                ;(scroller ?? window).scrollTo({ top: y, behavior: 'instant' })
                if (y < target) requestAnimationFrame(scroll)
                else resolve()
              }
              requestAnimationFrame(scroll)
            })
          })
        } else if (scenario === 'jump' || scenario === 'reader') {
          await page.evaluate(() => document.querySelector('#now .home-gallery').scrollIntoView({ block: 'center', behavior: 'instant' }))
          if (scenario === 'reader') {
            await page.waitForTimeout(100)
            await page.evaluate(() => { window.__beginImages('reader'); document.querySelector('#now .home-gallery-open').click() })
          }
        } else if (scenario === 'menu') {
          if (profile.isMobile) {
            await page.locator('.nav-menu-button').click()
            await page.evaluate(() => window.__beginImages('menu'))
            await page.locator('#mobile-nav-toggle-projects').click()
          } else await page.locator('#nav-toggle-projects').click()
        }
        await page.waitForTimeout(scenario === 'reader' ? 10000 : 5000)
        const images = await page.evaluate(() => window.__readImages())
        if (scenario !== 'idle') assert.ok(images.images.length > 0, 'The interaction must expose images to the viewport')
        const traffic = network.read()
        const used = new Set(images.images.map(item => item.path))
        const imageTraffic = traffic.list.filter(item => item.type === 'Image')
        const duplicateBodies = imageTraffic.filter((item, index, list) => item.bytes > 500 && !item.cached
          && list.slice(0, index).some(previous => previous.path === item.path && previous.bytes > 500 && !previous.cached))
        assert.deepEqual(errors, [])
        assert.deepEqual(duplicateBodies, [], 'A candidate body should not be downloaded twice')
        assert.equal(imageTraffic.filter(item => item.failed).length, 0, 'Images complete without network failures')
        const sample = { version, profile: name, scenario, run, started, before, ...images, network: traffic,
          imageBytes: imageTraffic.reduce((sum, item) => sum + item.bytes, 0),
          unusedImageBytes: imageTraffic.filter(item => !used.has(item.path) && !item.path.includes('github-avatar')).reduce((sum, item) => sum + item.bytes, 0),
          maxWait: Math.max(0, ...images.images.map(item => item.wait)) }
        samples.push(sample)
        console.log(JSON.stringify({ version, profile: name, scenario, run, maxWait: Math.round(sample.maxWait),
          imageKiB: Math.round(sample.imageBytes / 102.4) / 10, unusedKiB: Math.round(sample.unusedImageBytes / 102.4) / 10,
          pending: traffic.pending, feedback: sample.feedback }))
      } finally { await context.close() }
      await writeFile(`${output}/measure-${outputName}.json`, JSON.stringify({ methodVersion, browser: browser.version(), runs, ect, samples }, null, 2))
    }
  }
} catch (error) { console.error(`Image measurement failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
