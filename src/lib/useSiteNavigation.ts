import { useEffect, useLayoutEffect, useState } from 'react'
import { scrollToHashTarget } from './hashScroll'
import { notifyNavigationScroll } from './pageScrollSource'
import { getPageFromUrl, getProjectFromUrl, isProjectStudioUrl, type SitePage } from './routes'

type Position = { left: number; top: number }
type Navigation = { page: SitePage; href: string; position?: Position; focus: boolean; behavior?: ScrollBehavior }
const historyKey = 'siteNavigationKey'
const positionKey = 'siteNavigationPosition'

function savedPosition(): Position | undefined {
  const value = window.history.state?.[positionKey]
  return value && Number.isFinite(value.left) && Number.isFinite(value.top) ? value : undefined
}

/** Keep the shared layout alive while retaining independently addressable HTML pages. */
export function useSiteNavigation(initialPage: SitePage) {
  const [navigation, setNavigation] = useState<Navigation>({ page: initialPage, href: window.location.href, position: savedPosition(), focus: false })

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
    const persistPosition = () => {
      savePosition()
      window.history.replaceState({ ...window.history.state, [positionKey]: positions.get(currentKey) }, '')
    }
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
      if (anchor.hasAttribute('data-project-return') && Number.isInteger(window.history.state?.projectReturnDepth) && window.history.state.projectReturnDepth > 0) {
        event.preventDefault()
        persistPosition()
        window.history.go(-window.history.state.projectReturnDepth)
        return
      }
      const behavior = url.pathname === window.location.pathname && url.search === window.location.search && url.hash.length > 1
        ? 'smooth' : 'instant'
      event.preventDefault()
      persistPosition()
      if (url.href !== window.location.href) {
        const currentUrl = new URL(window.location.href)
        const fromList = getPageFromUrl(currentUrl) === 'projects'
          && !getProjectFromUrl(currentUrl) && !isProjectStudioUrl(currentUrl)
        const returnDepth = getProjectFromUrl(url) || isProjectStudioUrl(url)
          ? (fromList ? 1 : window.history.state?.projectReturnDepth ? window.history.state.projectReturnDepth + 1 : undefined)
          : undefined
        currentKey = crypto.randomUUID()
        window.history.pushState({ [historyKey]: currentKey, projectReturnDepth: returnDepth }, '', url)
      }
      setNavigation({ page, href: url.href, focus: true, behavior })
    }
    const pop = () => {
      const page = getPageFromUrl(new URL(window.location.href))
      if (!page) return
      currentKey = ensureKey()
      setNavigation({ page, href: window.location.href, position: positions.get(currentKey) ?? savedPosition(), focus: true })
    }
    document.addEventListener('click', click)
    window.addEventListener('popstate', pop)
    window.addEventListener('scroll', savePosition, { passive: true })
    window.addEventListener('pagehide', persistPosition)
    return () => {
      window.history.scrollRestoration = previousRestoration
      document.removeEventListener('click', click)
      window.removeEventListener('popstate', pop)
      window.removeEventListener('scroll', savePosition)
      window.removeEventListener('pagehide', persistPosition)
    }
  }, [])

  useLayoutEffect(() => {
    if (navigation.focus) document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
    let interacted = false
    const scroll = () => {
      if (interacted) return
      notifyNavigationScroll()
      if (navigation.position) window.scrollTo({ ...navigation.position, behavior: 'instant' })
      else if (!scrollToHashTarget({ behavior: navigation.behavior ?? 'instant' }) && navigation.focus) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    scroll()
    const frame = window.requestAnimationFrame(scroll)
    // A lazy document can arrive after the initial layout. Restore only until
    // the visitor starts interacting, so loading never pulls them away.
    const interact = () => { interacted = true }
    const ready = () => { if (!interacted) scroll() }
    window.addEventListener('project-document-ready', ready)
    window.addEventListener('wheel', interact, { passive: true })
    window.addEventListener('touchstart', interact, { passive: true })
    window.addEventListener('pointerdown', interact)
    window.addEventListener('keydown', interact)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('project-document-ready', ready)
      window.removeEventListener('wheel', interact)
      window.removeEventListener('touchstart', interact)
      window.removeEventListener('pointerdown', interact)
      window.removeEventListener('keydown', interact)
    }
  }, [navigation])

  return navigation
}
