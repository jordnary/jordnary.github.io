import { useEffect, useLayoutEffect, useState } from 'react'
import { scrollToHashTarget } from './hashScroll'
import { getPageFromUrl, type SitePage } from './routes'

type Position = { left: number; top: number }
type Navigation = { page: SitePage; position?: Position; focus: boolean; behavior?: ScrollBehavior }
const historyKey = 'siteNavigationKey'

/** Keep the shared layout alive while retaining independently addressable HTML pages. */
export function useSiteNavigation(initialPage: SitePage) {
  const [navigation, setNavigation] = useState<Navigation>({ page: initialPage, focus: false })

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const positions = new Map<string, Position>()
    const ensureKey = () => {
      const key = window.history.state?.[historyKey] ?? crypto.randomUUID()
      window.history.replaceState({ ...window.history.state, [historyKey]: key }, '')
      return key as string
    }
    let currentKey = ensureKey()
    const savePosition = () => positions.set(currentKey, { left: window.scrollX, top: window.scrollY })
    savePosition()

    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')
        || (anchor.target && anchor.target.toLowerCase() !== '_self') || anchor.relList.contains('external')) return
      const url = new URL(anchor.href)
      if (url.origin !== window.location.origin) return
      const page = getPageFromUrl(url)
      if (!page) return
      const behavior = url.pathname === window.location.pathname && url.search === window.location.search && url.hash.length > 1
        ? 'smooth' : 'instant'
      event.preventDefault()
      savePosition()
      if (url.href !== window.location.href) {
        currentKey = crypto.randomUUID()
        window.history.pushState({ [historyKey]: currentKey }, '', url)
      }
      setNavigation({ page, focus: true, behavior })
    }
    const pop = () => {
      const page = getPageFromUrl(new URL(window.location.href))
      if (!page) return
      currentKey = ensureKey()
      setNavigation({ page, position: positions.get(currentKey), focus: true })
    }
    document.addEventListener('click', click)
    window.addEventListener('popstate', pop)
    window.addEventListener('scroll', savePosition, { passive: true })
    return () => {
      window.history.scrollRestoration = previousRestoration
      document.removeEventListener('click', click)
      window.removeEventListener('popstate', pop)
      window.removeEventListener('scroll', savePosition)
    }
  }, [])

  useLayoutEffect(() => {
    if (navigation.focus) document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
    const scroll = () => {
      if (navigation.position) window.scrollTo({ ...navigation.position, behavior: 'instant' })
      else if (!scrollToHashTarget({ behavior: navigation.behavior ?? 'instant' }) && navigation.focus) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    scroll()
    const frame = window.requestAnimationFrame(scroll)
    return () => window.cancelAnimationFrame(frame)
  }, [navigation])

  return navigation.page
}
