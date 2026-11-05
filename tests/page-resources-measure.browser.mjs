import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { routeCases, profiles, connectionState, contentReady } from './page-resources.browser.mjs'

// Compare two already-built production previews; never build or run other browsers during sampling.
const allVersions = [
  ['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/'],
  ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'],
]
const options = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')))
const versions = allVersions.filter(([version]) => !options.has('version') || options.get('version') === version)
const runs = Number(options.get('runs') || 3)
const selectedRoutes = routeCases.filter(([path]) => !options.has('route') || options.get('route').split(',').includes(path))
const comparisonProfiles = [...profiles, { ...profiles[0], name: 'desktop-network',
  network: { latency: 50, downloadThroughput: 10_000_000 / 8, uploadThroughput: 5_000_000 / 8 } }]
const selectedProfiles = comparisonProfiles.filter(profile => options.has('profile')
  ? options.get('profile') === profile.name : profile.name !== 'desktop-network')
const output = 'node_modules/.cache/page-resources'
const reportName = options.get('output') || 'measure.json'
assert.match(reportName, /^[a-z0-9-]+\.json$/)
const settleMs = 500

function installSampler(cases) {
  const tasks = []
  let fcp = null
  let lcp = null
  let cls = 0
  let shiftStart = -Infinity
  let lastShift = -Infinity
  let shiftValue = 0
  const observe = (type, consume) => new PerformanceObserver(list => list.getEntries().forEach(consume)).observe({ type, buffered: true })
  observe('longtask', entry => tasks.push({ start: entry.startTime, duration: entry.duration }))
  observe('paint', entry => { if (entry.name === 'first-contentful-paint') fcp = entry.startTime })
  observe('largest-contentful-paint', entry => { lcp = entry.startTime })
  observe('layout-shift', entry => {
    if (entry.hadRecentInput) return
    if (entry.startTime - lastShift > 1000 || entry.startTime - shiftStart > 5000) { shiftValue = 0; shiftStart = entry.startTime }
    lastShift = entry.startTime
    shiftValue += entry.value
    cls = Math.max(cls, shiftValue)
  })
  window.__beginResourceSample = (path, cold = false) => {
    const sample = window.__resourceSample = { start: cold ? 0 : performance.now(), mountedMs: null, readyMs: null, feedbackMs: null }
    const selector = cases.find(item => item[0] === path)[1]
    const poll = async () => {
      if (window.__resourceSample !== sample) return
      const mounted = location.pathname === path && document.querySelector(`main ${selector}`)
      if (sample.feedbackMs === null && (mounted || document.querySelector('.page-load-feedback,.site-startup'))) sample.feedbackMs = performance.now() - sample.start
      if (!mounted || document.querySelector('.page-load-feedback')) { requestAnimationFrame(poll); return }
      sample.mountedMs = performance.now() - sample.start
      // This measures usable first-screen content, including selected images and fonts.
      // It is not TTI or an assertion that every decorative animation has ended.
      await new Promise(resolve => requestAnimationFrame(resolve))
      const visibleImages = await new Promise(resolve => {
        const candidates = [...document.querySelectorAll('main img')].filter(image => image.loading !== 'lazy')
        if (!candidates.length) { resolve([]); return }
        const observer = new IntersectionObserver(entries => {
          observer.disconnect()
          resolve(entries.filter(entry => entry.isIntersecting && entry.intersectionRatio > 0).map(entry => entry.target))
        })
        candidates.forEach(image => observer.observe(image))
      })
      // Entering artwork can still be masked while it is loading. It is required
      // content even before its first non-empty intersection (notably Learning).
      const criticalImages = document.querySelectorAll('img.learning-cover-panorama,img.learning-cover-tree-art,img.archive-background,.studio-gallery-frame:first-child img,.project-reader-cover img')
      const images = [...new Set([...visibleImages, ...criticalImages])]
      const backgrounds = [
        [document.querySelector('.journey-cover > .section-backdrop'), '::before'],
        [document.querySelector('.correspondence-graffiti'), null],
      ].flatMap(([node, pseudo]) => {
        if (!node) return []
        const source = getComputedStyle(node, pseudo).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1]
        if (!source) return []
        const image = new Image()
        image.src = source
        return [image]
      })
      await Promise.all([...images, ...backgrounds].map(image => image.decode().catch(() => {})))
      await document.fonts.ready
      while (document.querySelector('.project-page-transition')) await new Promise(resolve => requestAnimationFrame(resolve))
      await new Promise(resolve => requestAnimationFrame(resolve))
      sample.readyMs = performance.now() - sample.start
      sample.images = images.map(image => ({ path: new URL(image.currentSrc).pathname, width: image.naturalWidth, height: image.naturalHeight }))
    }
    requestAnimationFrame(poll)
  }
  window.__readResourceSample = () => {
    const sample = window.__resourceSample
    const durations = tasks.filter(task => task.start >= sample.start).map(task => task.duration)
    return { ...sample, sampledAtMs: performance.now() - sample.start, fcpMs: fcp, lcpMs: lcp, cls,
      longTaskMs: durations.reduce((sum, value) => sum + value, 0),
      blockingMs: durations.reduce((sum, value) => sum + Math.max(0, value - 50), 0),
      domNodes: document.getElementsByTagName('*').length }
  }
  if (cases.some(item => item[0] === location.pathname)) window.__beginResourceSample(location.pathname, true)
}

function networkRecorder(cdp) {
  const requests = new Map()
  let phase = 'cold'
  cdp.on('Network.requestWillBeSent', event => requests.set(event.requestId, {
    phase, path: new URL(event.request.url).pathname, type: event.type, priority: event.request.initialPriority,
    bytes: 0, receivedBytes: 0, done: false, failed: false, cached: false,
  }))
  cdp.on('Network.dataReceived', event => { const item = requests.get(event.requestId); if (item) item.receivedBytes += event.encodedDataLength })
  cdp.on('Network.responseReceived', event => {
    const item = requests.get(event.requestId)
    if (item) item.cached ||= event.response.fromDiskCache || event.response.fromServiceWorker
  })
  cdp.on('Network.requestServedFromCache', event => { const item = requests.get(event.requestId); if (item) item.cached = true })
  cdp.on('Network.loadingFinished', event => {
    const item = requests.get(event.requestId)
    if (item) { item.done = true; item.bytes = event.encodedDataLength }
  })
  cdp.on('Network.loadingFailed', event => { const item = requests.get(event.requestId); if (item) item.failed = true })
  return {
    phase: value => { phase = value },
    read: phases => {
      const list = [...requests.values()].filter(item => phases.includes(item.phase))
      return { requests: list.length, pending: list.filter(item => !item.done && !item.failed).length,
        failed: list.filter(item => item.failed).length, cached: list.filter(item => item.cached).length,
        wireBytes: list.reduce((sum, item) => sum + item.bytes, 0),
        partialBytes: list.filter(item => !item.done).reduce((sum, item) => sum + item.receivedBytes, 0), list }
    },
  }
}

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || 'msedge', headless: true })
const result = options.has('merge') ? JSON.parse(await readFile(`${output}/${reportName}`, 'utf8'))
  : { browser: browser.version(), runs, settleMs, intentMs: 300, motion: 'no-preference', samples: [] }
if (options.has('merge')) result.samples = result.samples.filter(sample => sample.phase === 'unused-intent'
  || !versions.some(([version]) => version === sample.version)
  || !selectedRoutes.some(([path]) => path === sample.path) || !selectedProfiles.some(profile => profile.name === sample.profile))
result.readiness = 'declared critical images, intersecting eager images, fonts and transition completion'
async function withPage(profile, fn) {
  const { name, cpu, network: networkSettings, ...settings } = profile
  const context = await browser.newContext({ ...settings, reducedMotion: 'no-preference', serviceWorkers: 'block' })
  await context.addInitScript(connectionState, name === 'mobile-constrained'
    ? { effectiveType: '4g', downlink: 1.6, rtt: 150, saveData: false }
    : { effectiveType: '4g', downlink: 10, rtt: networkSettings?.latency ?? 20, saveData: false })
  await context.addInitScript(installSampler, routeCases)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  if (name === 'mobile-constrained') await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8,
  })
  else if (networkSettings) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...networkSettings })
  const network = networkRecorder(cdp)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try { await fn(page, network); assert.deepEqual(errors, []) }
  catch (error) {
    console.log(JSON.stringify(await page.evaluate(() => ({
      path: location.pathname, sample: window.__resourceSample,
      feedback: document.querySelector('.page-load-feedback')?.textContent,
      images: [...document.querySelectorAll('main img')].filter(image => !image.complete).map(image => ({
        path: new URL(image.currentSrc || image.src).pathname, top: image.getBoundingClientRect().top,
        width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, loading: image.loading,
      })),
    }))))
    throw error
  }
  finally { await context.close() }
}
const ready = page => page.waitForFunction(() => typeof window.__resourceSample?.readyMs === 'number', undefined, { timeout: 60000 })
const read = async (page, network, phases) => {
  await ready(page)
  await page.waitForTimeout(settleMs)
  const metrics = await page.evaluate(() => window.__readResourceSample())
  const traffic = network.read(phases)
  assert.equal(traffic.failed, 0)
  return { ...metrics, network: traffic }
}
async function navigate(page, path) {
  await page.evaluate(path => {
    window.__beginResourceSample(path)
    const link = document.createElement('a')
    link.href = path
    document.body.append(link)
    link.click()
    link.remove()
  }, path)
}
try {
  await mkdir(output, { recursive: true })
  for (const [version, base] of versions) for (const profile of selectedProfiles) for (const [path, selector] of selectedRoutes) {
    for (let run = 1; run <= runs; run++) {
      const identity = { version, profile: profile.name, path, run }
      await withPage(profile, async (page, network) => {
        await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 })
        result.samples.push({ ...identity, phase: 'cold', ...await read(page, network, ['cold']) })
      })
      await withPage(profile, async (page, network) => {
        const source = path === '/home/' ? '/contact/' : '/home/'
        await page.goto(new URL(source, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await ready(page)
        await page.waitForTimeout(settleMs)
        network.phase('intent')
        await page.evaluate(path => {
          const link = document.createElement('a')
          link.href = path
          link.id = 'measure-intent'
          link.textContent = 'Target'
          link.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99999'
          document.body.append(link)
          link.focus({ preventScroll: true })
        }, path)
        await page.waitForTimeout(300)
        const intent = network.read(['intent'])
        network.phase('first')
        await navigate(page, path)
        await page.evaluate(() => document.getElementById('measure-intent')?.remove())
        result.samples.push({ ...identity, phase: 'first', intentNetwork: intent, ...await read(page, network, ['intent', 'first']) })
        network.phase('return')
        await navigate(page, source)
        await ready(page)
        await page.waitForTimeout(settleMs)
        network.phase('repeat')
        await navigate(page, path)
        result.samples.push({ ...identity, phase: 'repeat', ...await read(page, network, ['repeat']) })
        assert.equal(await page.locator(selector).count(), 1)
      })
    }
    console.log(JSON.stringify({ version, profile: profile.name, path, runs, status: 'measured' }))
    await writeFile(`${output}/${reportName}`, JSON.stringify(result, null, 2))
  }
  if (options.has('waste')) for (const [version, base] of versions) for (const [path] of selectedRoutes) {
    if (path === '/home/') continue
    await withPage(profiles[0], async (page, network) => {
      await page.goto(new URL('/home/', base).href)
      await contentReady(page, '.home-editorial')
      await page.waitForTimeout(settleMs)
      network.phase('unused-intent')
      await page.evaluate(path => {
        const link = document.createElement('a')
        link.href = path
        link.textContent = 'Target'
        document.body.append(link)
        link.focus({ preventScroll: true })
      }, path)
      await page.waitForTimeout(2000)
      result.samples.push({ version, profile: 'desktop', path, phase: 'unused-intent', network: network.read(['unused-intent']) })
      assert.equal(await page.locator('.home-editorial').count(), 1)
    })
  }
  await writeFile(`${output}/${reportName}`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ samples: result.samples.length, status: 'saved' }))
} catch (error) { console.error(`Resource measurement failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
