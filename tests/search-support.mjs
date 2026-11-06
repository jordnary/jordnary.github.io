import { connectionState, contentReady } from './page-resources.browser.mjs'
export { connectionState }
export const baseURL = process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4184/'
export const output = 'node_modules/.cache/search-split'
export const featurePattern = /\/assets\/SiteSearchResults-[^/]+\.(js|css)(\?.*)?$/
export const profiles = [
  { name: 'desktop-network', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mbps: 10, latency: 50 },
  { name: 'desktop-weak', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mbps: 1.6, latency: 150 },
  { name: 'mobile-weak', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4, mbps: 1.6, latency: 150 },
]
export async function launch() {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  return chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || 'msedge', headless: true, args: ['--force-effective-connection-type=3G'] })
}
export async function home(page, base = baseURL, route = 'home/') {
  await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded' })
  await contentReady(page, route === 'learning/' ? '.learning-studio' : route === 'contact/' ? '.correspondence' : '.home-editorial')
}
export function recorder(cdp) {
  const requests = new Map()
  let phase = 'startup'
  cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId, {
    phase, path: new URL(e.request.url).pathname, type: e.type, bytes: 0, partial: 0, done: false, failed: false, cached: false, status: null,
  }))
  cdp.on('Network.responseReceived', e => { const r = requests.get(e.requestId); if (r) { r.status = e.response.status; r.cached ||= e.response.fromDiskCache } })
  cdp.on('Network.dataReceived', e => { const r = requests.get(e.requestId); if (r) r.partial += e.encodedDataLength })
  cdp.on('Network.requestServedFromCache', e => { const r = requests.get(e.requestId); if (r) r.cached = true })
  cdp.on('Network.loadingFinished', e => { const r = requests.get(e.requestId); if (r) { r.done = true; r.bytes = e.encodedDataLength } })
  cdp.on('Network.loadingFailed', e => { const r = requests.get(e.requestId); if (r) r.failed = true })
  return { phase: value => { phase = value }, reset: () => requests.clear(), read: () => [...requests.values()].map(r => ({ ...r })) }
}
export function sampler() {
  const tasks = []
  new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))))
    .observe({ type: 'longtask', buffered: true })
  window.__measureSearch = (method = 'shortcut') => {
    const result = { start: performance.now(), feedback: null, results: null, settled: null }
    window.__searchSample = result
    const visible = el => {
      if (!el || !el.getClientRects().length) return false
      const r = el.getBoundingClientRect()
      if (r.bottom <= 0 || r.top >= innerHeight) return false
      for (let node = el; node instanceof HTMLElement; node = node.parentElement) {
        const s = getComputedStyle(node)
        if (s.visibility === 'hidden' || Number(s.opacity) < .01) return false
      }
      return true
    }
    if (method === 'shortcut') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }))
    else document.querySelector('[data-search-trigger],.nav-search-button').click()
    const tick = () => {
      const surface = document.querySelector('.site-search-dialog')
      const elapsed = performance.now() - result.start
      if (visible(surface) && visible(surface.querySelector('input')) && visible(surface.querySelector('.site-search-footer button'))) result.feedback ??= elapsed
      if (visible(document.querySelector('.site-search-result'))) {
        result.results ??= elapsed
        if (!surface.getAnimations({ subtree: true }).some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)) result.settled ??= elapsed
      }
      if (elapsed < 10000 && result.settled === null) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  window.__readSearch = () => {
    const result = window.__searchSample
    const selected = tasks.filter(t => t.start + t.duration > result.start)
    return { ...result, longTaskMs: selected.reduce((s, t) => s + t.duration, 0),
      blockingMs: selected.reduce((s, t) => s + Math.max(0, t.duration - 50), 0),
      maxTaskMs: Math.max(0, ...selected.map(t => t.duration)), domNodes: document.querySelectorAll('*').length }
  }
}
