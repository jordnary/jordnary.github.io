import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'

// Run against a fresh production preview. Output contains no host paths or URLs.
const args = new Map(process.argv.slice(2).map(value => value.replace(/^--/, '').split('=')))
const runs = Number(args.get('runs') ?? 3)
const settleMs = Number(args.get('settle-ms') ?? 2000)
if (!Number.isInteger(runs) || runs < 1 || !Number.isFinite(settleMs) || settleMs < 0) {
  throw new Error('Invalid baseline sampling options')
}
const baseURL = process.env.UX_BASELINE_URL || 'http://127.0.0.1:4173/'
const routes = (args.get('routes') || '/,/home/,/about/,/learning/,/projects/,/projects/studio/,/projects/vae-gan-digits/,/contact/').split(',')
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1 },
  { name: 'mobile-constrained', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4,
    network: { latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 } },
].filter(profile => !args.has('profile') || profile.name === args.get('profile'))
if (!profiles.length) throw new Error('Unknown baseline profile')
const round = value => Number(value.toFixed(1))

function installObservers() {
  performance.setResourceTimingBufferSize(2000)
  const state = window.__uxBaseline = { readyMs: null, fcpMs: null, lcpMs: null, cls: 0, longTasks: [] }
  let sessionValue = 0
  let sessionStart = -Infinity
  let lastShift = -Infinity
  const observe = (type, consume) => {
    if (PerformanceObserver.supportedEntryTypes.includes(type)) {
      new PerformanceObserver(list => list.getEntries().forEach(consume)).observe({ type, buffered: true })
    }
  }
  observe('paint', entry => { if (entry.name === 'first-contentful-paint') state.fcpMs = entry.startTime })
  observe('largest-contentful-paint', entry => { state.lcpMs = entry.startTime })
  observe('longtask', entry => state.longTasks.push(entry.duration))
  observe('layout-shift', entry => {
    if (entry.hadRecentInput) return
    if (entry.startTime - lastShift > 1000 || entry.startTime - sessionStart > 5000) {
      sessionStart = entry.startTime
      sessionValue = 0
    }
    lastShift = entry.startTime
    sessionValue += entry.value
    state.cls = Math.max(state.cls, sessionValue)
  })
  // A mount marker, not TTI: authored reveals and images can still be in flight.
  const ready = new MutationObserver(() => {
    if (!document.querySelector('main > :first-child')) return
    ready.disconnect()
    requestAnimationFrame(() => { state.readyMs = performance.now() })
  })
  ready.observe(document, { childList: true, subtree: true })
}

async function sample(page, session, url, warm) {
  const requests = new Map()
  const errors = []
  const error = () => errors.push(true)
  const requested = event => requests.set(event.requestId, {
    type: event.type, finished: false, failed: false, bytes: 0, cached: false, status: null,
  })
  const response = event => {
    const request = requests.get(event.requestId)
    if (request) request.cached ||= Boolean(event.response.fromDiskCache || event.response.fromServiceWorker)
  }
  const cached = event => { const request = requests.get(event.requestId); if (request) request.cached = true }
  const extraResponse = event => { const request = requests.get(event.requestId); if (request) request.status = event.statusCode }
  const finished = event => {
    const request = requests.get(event.requestId)
    if (request) { request.finished = true; request.bytes = event.encodedDataLength }
  }
  const failed = event => { const request = requests.get(event.requestId); if (request) request.failed = true }
  const listeners = { requestWillBeSent: requested, responseReceived: response, responseReceivedExtraInfo: extraResponse,
    requestServedFromCache: cached, loadingFinished: finished, loadingFailed: failed }
  for (const [name, listener] of Object.entries(listeners)) session.on(`Network.${name}`, listener)
  page.on('pageerror', error)
  try {
    if (warm) await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
    else await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => window.__uxBaseline?.readyMs != null, undefined, { timeout: 60000 })
    // Include a fixed observation window after the route mounts; never wait for networkidle.
    await page.waitForTimeout(settleMs)
    const metrics = await page.evaluate(() => {
      const { longTasks, ...state } = window.__uxBaseline
      const navigation = performance.getEntriesByType('navigation')[0]
      return { ...state, sampledAtMs: performance.now(), dclMs: navigation.domContentLoadedEventEnd,
        longTaskCount: longTasks.length, longTaskMs: longTasks.reduce((sum, duration) => sum + duration, 0),
        blockingMs: longTasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0),
        resourceBodyBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        domNodes: document.getElementsByTagName('*').length }
    })
    const byType = {}
    for (const request of requests.values()) {
      const group = byType[request.type] ??= { requests: 0, completed: 0, pending: 0, failed: 0, cached: 0, notModified: 0, wireBytes: 0 }
      group.requests++
      group.completed += Number(request.finished)
      group.pending += Number(!request.finished && !request.failed)
      group.failed += Number(request.failed)
      group.cached += Number(request.cached)
      group.notModified += Number(request.status === 304)
      group.wireBytes += request.bytes
    }
    return { ...Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, typeof value === 'number'
      ? key === 'cls' ? Number(value.toFixed(6)) : round(value) : value])),
      pageErrors: errors.length, network: byType }
  } finally {
    for (const [name, listener] of Object.entries(listeners)) session.off(`Network.${name}`, listener)
    page.off('pageerror', error)
  }
}

async function buildInventory() {
  const assets = []
  for (const file of await readdir('dist/assets')) {
    if (!/\.(css|js)$/.test(file)) continue
    const data = await readFile(`dist/assets/${file}`)
    assets.push({ file: `assets/${file}`, bytes: data.length, gzipBytes: gzipSync(data).length })
  }
  return assets.sort((a, b) => b.bytes - a.bytes)
}

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: process.env.UX_BROWSER_CHANNEL || 'msedge', headless: true })
try {
  const result = { revision: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
    browser: browser.version(), runs, settleMs, motion: 'no-preference', profiles, assets: await buildInventory(), samples: [] }
  for (const profile of profiles) {
    const { name, cpu, network, ...options } = profile
    for (const route of routes) {
      for (let run = 1; run <= runs; run++) {
        const context = await browser.newContext({ ...options, reducedMotion: 'no-preference', serviceWorkers: 'block' })
        try {
          await context.addInitScript(installObservers)
          const page = await context.newPage()
          const session = await context.newCDPSession(page)
          await session.send('Network.enable')
          await session.send('Emulation.setCPUThrottlingRate', { rate: cpu })
          if (network) await session.send('Network.emulateNetworkConditions', { offline: false, ...network })
          for (const cache of ['cold', 'warm-reload']) {
            const metrics = await sample(page, session, new URL(route, baseURL).href, cache === 'warm-reload')
            result.samples.push({ profile: name, route, run, cache, ...metrics })
          }
        } finally { await context.close() }
      }
      console.log(JSON.stringify({ profile: name, route, runs, status: 'measured' }))
    }
  }
  const output = args.get('output') || 'node_modules/.cache/ux-baseline.json'
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({ samples: result.samples.length, status: 'saved' }))
} finally { await browser.close() }
