import { loadPage } from './page-loaders'
import { preparePageImages } from './page-images'
import { getPageResources } from './page-resources'
import { siteLink } from './site-link'
import { pageConnection, pageNetworkPolicy } from './page-network'

type Intent = { anchor: HTMLAnchorElement; url: URL; id: string; timer: number }
type Kind = 'pointer' | 'focus' | 'touch'

/** One running target, at most two waiting targets; required loads bypass this queue. */
export function installPagePrefetch() {
  const connection = pageConnection()
  const intents = new Map<Kind, Intent>()
  const queue = new Map<string, URL>()
  const completed = new Set<string>()
  let current = ''
  let currentUrl: URL | null = null
  let ready = false
  let imagesReady = false
  let running: string | null = null
  let disposed = false
  let timer = 0
  let idle = 0
  let visibility: IntersectionObserver | null = null
  let touchPoint: { x: number; y: number } | null = null
  let busyUntil = 0
  const idOf = (url: URL) => getPageResources(url, import.meta.env.BASE_URL)?.id ?? ''
  const allowed = () => !disposed && !document.hidden && pageNetworkPolicy().code
  const visibleReady = () => ready && imagesReady && performance.now() >= busyUntil
    && document.readyState === 'complete' && document.fonts.status === 'loaded'
  const stopSchedule = () => {
    window.clearTimeout(timer)
    if (idle) window.cancelIdleCallback(idle)
    visibility?.disconnect()
    visibility = null
    timer = idle = 0
  }
  const start = () => {
    if (!queue.size || running || !allowed()) return
    if (!visibleReady()) { later(); return }
    const [id, url] = [...queue].at(-1)!
    queue.delete(id)
    running = id
    completed.add(id)
    // Imports keep Vite's dependency/CSS gate and its single Promise owner.
    // They cannot be aborted or reprioritized after issue. Images are explicitly low.
    const tasks: Promise<unknown>[] = [loadPage(url, true)]
    if (pageNetworkPolicy().images) tasks.push(preparePageImages(url, 'low'))
    void Promise.allSettled(tasks).then(() => {
      running = null
      schedule()
    })
  }
  const later = () => { timer = window.setTimeout(() => { timer = 0; schedule() }, 200) }
  const pump = () => {
    idle = timer = 0
    if (!queue.size || running || !allowed()) return
    if (!visibleReady()) { later(); return }
    const pending = [...document.querySelectorAll<HTMLImageElement>('main img')].filter(image => !image.complete)
    if (!pending.length) { start(); return }
    // Native intersection accounts for clipped scrollers, masks and transformed artwork.
    // Observe only while an intent is waiting, and disconnect before starting any work.
    const observer = new IntersectionObserver(entries => {
      if (visibility !== observer) return
      observer.disconnect()
      visibility = null
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0 && !(entry.target as HTMLImageElement).complete)) later()
      else start()
    })
    visibility = observer
    pending.forEach(image => observer.observe(image))
  }
  const schedule = () => {
    if (disposed || running || timer || idle || visibility || !queue.size || !allowed()) return
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(pump)
    else timer = window.setTimeout(pump, 150)
  }
  const clearIntent = (kind: Kind) => {
    const previous = intents.get(kind)
    if (!previous) return
    window.clearTimeout(previous.timer)
    intents.delete(kind)
    if (![...intents.values()].some(intent => intent.id === previous.id)) queue.delete(previous.id)
    if (!queue.size) stopSchedule()
  }
  const clear = () => {
    for (const kind of intents.keys()) clearIntent(kind)
    queue.clear()
    stopSchedule()
    touchPoint = null
  }
  const enter = (kind: Kind, event: Event) => {
    const link = siteLink(event.target)
    if (!link || link.anchor.hasAttribute('data-site-reload')) return
    const id = idOf(link.url)
    if (!id || id === current || completed.has(id) || !allowed()) return
    if (intents.get(kind)?.anchor === link.anchor) return
    clearIntent(kind)
    const intent = { ...link, id, timer: 0 }
    intents.set(kind, intent)
    intent.timer = window.setTimeout(() => {
      if (!allowed() || completed.has(id) || id === current || !intent.anchor.isConnected || intents.get(kind) !== intent) return
      queue.delete(id)
      queue.set(id, link.url)
      while (queue.size > 2) queue.delete(queue.keys().next().value!)
      schedule()
    }, 100)
  }
  const leave = (kind: Kind, event: MouseEvent | FocusEvent) => {
    const intent = intents.get(kind)
    if (intent && !(event.relatedTarget instanceof Node && intent.anchor.contains(event.relatedTarget))) clearIntent(kind)
  }
  const modified = (event: MouseEvent) => event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
  const over = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' && !event.buttons && !modified(event)) enter('pointer', event)
  }
  const out = (event: PointerEvent) => leave('pointer', event)
  const focus = (event: FocusEvent) => enter('focus', event)
  const blur = (event: FocusEvent) => leave('focus', event)
  const down = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || event.button || modified(event)) return
    touchPoint = { x: event.clientX, y: event.clientY }
    enter('touch', event)
  }
  const move = (event: PointerEvent) => {
    if (touchPoint && Math.hypot(event.clientX - touchPoint.x, event.clientY - touchPoint.y) > 8) endTouch()
  }
  const endTouch = () => { clearIntent('touch'); touchPoint = null }
  const change = () => { if (!allowed()) clear(); else schedule() }
  const scrolling = () => { busyUntil = performance.now() + 150 }
  const committed = (event?: Event) => {
    if (event && (!(event instanceof CustomEvent) || event.detail?.href !== currentUrl?.href)) return
    ready = true
    const target = current
    if (currentUrl) void preparePageImages(currentUrl, 'high').then(() => {
      if (current === target) { imagesReady = true; schedule() }
    })
  }
  document.addEventListener('pointerover', over, { passive: true })
  document.addEventListener('pointerout', out, { passive: true })
  document.addEventListener('focusin', focus)
  document.addEventListener('focusout', blur)
  document.addEventListener('pointerdown', down, { passive: true })
  document.addEventListener('pointermove', move, { passive: true })
  document.addEventListener('pointerup', endTouch, { passive: true })
  document.addEventListener('pointercancel', endTouch, { passive: true })
  document.addEventListener('visibilitychange', change)
  window.addEventListener('pagehide', clear)
  window.addEventListener('site-page-ready', committed)
  window.addEventListener('scroll', scrolling, { passive: true, capture: true })
  connection?.addEventListener('change', change)
  return {
    current(url: URL, retained = false) {
      clear()
      current = idOf(url)
      currentUrl = url
      ready = false
      imagesReady = false
      if (retained) committed()
    },
    dispose() {
      disposed = true
      clear()
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', blur)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', endTouch)
      document.removeEventListener('pointercancel', endTouch)
      document.removeEventListener('visibilitychange', change)
      window.removeEventListener('pagehide', clear)
      window.removeEventListener('site-page-ready', committed)
      window.removeEventListener('scroll', scrolling, true)
      connection?.removeEventListener('change', change)
    },
  }
}
