import { loadPage } from './page-loaders'
import { pageNetworkPolicy } from './page-network'
import { siteLink } from './site-link'

/** Page code follows a link interaction. Shared site images load independently. */
export function installPagePrefetch() {
  let pending: HTMLAnchorElement | undefined
  let timer: number | undefined
  const events = new AbortController()
  const options = { passive: true, signal: events.signal }
  const clear = () => {
    window.clearTimeout(timer)
    pending = undefined
  }
  const enter = (event: PointerEvent | FocusEvent) => {
    if (event instanceof PointerEvent && (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) return
    const link = siteLink(event.target)
    if (!link || link.anchor === pending || link.anchor.hasAttribute('data-site-reload')
      || link.url.pathname === location.pathname || document.hidden || !pageNetworkPolicy().code) return
    clear()
    pending = link.anchor
    timer = window.setTimeout(() => {
      clear()
      if (link.anchor.isConnected && !document.hidden) void loadPage(link.url, true).catch(() => {})
    }, 100)
  }
  const leave = (event: PointerEvent | FocusEvent) => {
    if (pending?.contains(event.target as Node) && !pending.contains(event.relatedTarget as Node | null)) clear()
  }
  document.addEventListener('focusin', enter, options)
  document.addEventListener('focusout', leave, options)
  document.addEventListener('pointerover', event => { if (event.pointerType !== 'touch') enter(event) }, options)
  document.addEventListener('pointerout', leave, options)
  document.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') enter(event) }, options)
  document.addEventListener('pointercancel', clear, options)
  return () => { clear(); events.abort() }
}
