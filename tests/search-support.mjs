import { connectionState, contentReady } from './page-resources.browser.mjs'
export { connectionState }
export const baseURL = process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4194/'
export const output = 'node_modules/.cache/search-boundary'
export const versions = [
  ['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4195/'],
  ['split', process.env.SEARCH_SPLIT_URL || 'http://127.0.0.1:4196/'],
  ['candidate', baseURL],
]
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
  window.__measureSearch = ({ method = 'shortcut', query = '', expected, freeze = false }) => {
    const result = { start: performance.now(), feedback: null, typed: null, inputEcho: null, results: null, actionable: null, entranceEnded: null, settled: null }
    window.__searchSample = result
    let inputNode, selected = false
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
      const backdrop = document.querySelector('.site-search-backdrop')
      const input = surface?.querySelector('input')
      const elapsed = performance.now() - result.start
      if (visible(input) && visible(surface.querySelector('.site-search-footer button')) && document.activeElement === input) {
        result.feedback ??= elapsed
        inputNode ??= input
        if (query && result.typed === null) {
          result.typed = elapsed
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, query)
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: query }))
          requestAnimationFrame(tick)
          return
        }
        if (input.value === query) result.inputEcho ??= elapsed
      }
      const animations = [...(backdrop?.getAnimations() ?? []), ...(surface?.getAnimations() ?? [])]
      if (surface && !animations.some(a => a.playState === 'running')) result.entranceEnded ??= elapsed
      const items = [...document.querySelectorAll('.site-search-result')]
      const correct = items.length === expected.length && items.every((a, i) =>
        a.querySelector('strong').textContent === expected[i].title && new URL(a.href).pathname + new URL(a.href).hash === expected[i].href)
      const first = items[0]
      if (input?.value === query && correct && visible(first)) {
        result.results ??= elapsed
        if (!result.firstFrame) {
          const bounds = first.getBoundingClientRect()
          result.firstFrame = { display: getComputedStyle(first).display, opacity: getComputedStyle(surface).opacity,
            entranceRunning: animations.some(a => a.playState === 'running'), width: bounds.width, height: bounds.height }
          if (freeze) { animations.forEach(a => a.pause()); result.frozen = true; return }
        }
        if (result.entranceEnded !== null) result.settled ??= elapsed
        const r = first.getBoundingClientRect()
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        if (first.contains(hit) && !first.closest('[inert]') && document.activeElement === input) {
          if (!selected) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
            selected = true
          } else if (input.getAttribute('aria-activedescendant') === first.id) {
            // Prove Enter reaches the selected link without navigating or closing the measured surface.
            const intercept = event => {
              if (event.target.closest('.site-search-result') === first) {
                event.preventDefault(); event.stopImmediatePropagation()
                result.actionable ??= performance.now() - result.start
              }
            }
            document.addEventListener('click', intercept, true)
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
            document.removeEventListener('click', intercept, true)
          }
        }
      }
      result.sameInput = !inputNode || inputNode === input
      if (elapsed < 10000 && (result.settled === null || result.actionable === null)) requestAnimationFrame(tick)
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
