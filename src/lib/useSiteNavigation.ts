import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { scrollToHashTarget } from './hashScroll'
import { notifyNavigationScroll, getPageScrollTop, getPageScrollLeft, scrollPageTo } from './pageScrollSource'
import { getPageFromUrl, getProjectFromUrl, isProjectStudioUrl, type SitePage } from './routes'
import { shouldTransitionProjects } from './project-page-transition'
import { loadPage, type PageModule } from './page-loaders'
import { PageLoadTimeoutError, projectCoverBudgetMs, reopenPage, waitForPage } from './page-loading'
import type { PageLoadState } from '../components/PageLoadFeedback'
import type {} from './projectTransitionBoot'

type Position = { left: number; top: number }
type Navigation = { page: SitePage; href: string; position?: Position; focus: boolean; behavior?: ScrollBehavior; module?: PageModule }
type PageTransition = { id: number; initiallyCovered?: boolean; onCovered: () => Promise<void>; onComplete: () => void }
type Actions = { retry: () => void; cancel: () => void; renderFailed: () => void }
const historyKey = 'siteNavigationKey'
const positionKey = 'siteNavigationPosition'
const indexKey = 'siteNavigationIndex'

function savedPosition(): Position | undefined {
  const value = window.history.state?.[positionKey]
  return value && Number.isFinite(value.left) && Number.isFinite(value.top) ? value : undefined
}

/** Load before committing; only the latest navigation owns history, focus and scroll. */
export function useSiteNavigation(initialPage: SitePage) {
  const [navigation, setNavigation] = useState<Navigation>(() => ({ page: initialPage, href: window.location.href, position: savedPosition(), focus: false }))
  const [loading, setLoading] = useState<PageLoadState | null>(() => ({ href: window.location.href, status: 'loading' }))
  const [transition, setTransition] = useState<PageTransition | null>(null)
  const transitioning = useRef(false)
  const actions = useRef<Actions | null>(null)

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const positions = new Map<string, Position>()
    const ensureKey = () => {
      const state = window.history.state
      const key = state?.[historyKey] ?? crypto.randomUUID()
      window.history.replaceState({ ...state, [historyKey]: key, [indexKey]: state?.[indexKey] ?? 0 }, '')
      return key as string
    }
    let currentKey = ensureKey()
    let currentIndex = window.history.state[indexKey] as number
    let renderedHref = window.location.href
    let revision = 0
    let active: { id: number; controller: AbortController; retry: () => void; committed: boolean } | null = null
    let coverTimer = 0
    const savePosition = () => {
      // The retained page remains scrollable during ordinary pending/error states.
      positions.set(currentKey, { left: getPageScrollLeft(), top: getPageScrollTop() })
    }
    const persistPosition = () => {
      savePosition()
      if (window.history.state?.[historyKey] === currentKey) {
        window.history.replaceState({ ...window.history.state, [positionKey]: positions.get(currentKey) }, '')
      }
    }
    const releaseCover = () => {
      window.clearTimeout(coverTimer)
      setTransition(null)
      window.dispatchEvent(new Event('site-navigation-interrupted'))
    }
    const cancelActive = () => {
      active?.controller.abort()
      active = null
      window.clearTimeout(coverTimer)
    }
    savePosition()

    const navigate = (next: Navigation, commitHistory: () => void, initiallyCovered = false, initial = false) => {
      cancelActive()
      const id = ++revision
      const controller = new AbortController()
      const attempt = { id, controller, committed: false, retry: () => navigate({ ...next, focus: true }, commitHistory, false, initial) }
      active = attempt
      setLoading({ href: next.href, status: 'loading' })
      let covered = false
      let module: PageModule | undefined
      let animate = initiallyCovered || (!initial && shouldTransitionProjects(new URL(renderedHref), new URL(next.href))
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden)
      const commit = () => {
        if (active !== attempt || controller.signal.aborted || attempt.committed || !module) return
        attempt.committed = true
        commitHistory()
        currentIndex = window.history.state[indexKey]
        renderedHref = next.href
        setNavigation({ ...next, module })
        setLoading(null)
      }
      // Import rejection and timeouts are handled here, before any history/page commit.
      const ready = waitForPage(loadPage(new URL(next.href)), controller.signal).then(value => {
        module = value
        // Reload paper is opaque from its first HTML frame. Prepare content
        // behind it immediately, without delaying the existing reveal timeline.
        if (!animate || covered || initiallyCovered) commit()
      }, error => {
        if (active !== attempt || controller.signal.aborted) return
        setLoading({ href: next.href, status: 'error', reason: error instanceof PageLoadTimeoutError ? 'timeout' : 'load' })
        if (!(error instanceof PageLoadTimeoutError)) attempt.retry = () => reopenPage(next.href)
        releaseCover()
      })
      if (!animate) {
        setTransition(null)
        return
      }
      // Paper has a short visual budget; the request has its own longer deadline.
      // Once paper is released a late, still-current result may commit normally.
      const budget = new Promise<void>(resolve => {
        coverTimer = window.setTimeout(() => {
          if (active === attempt && !attempt.committed) {
            animate = false
            releaseCover()
          }
          resolve()
        }, projectCoverBudgetMs)
        controller.signal.addEventListener('abort', () => { window.clearTimeout(coverTimer); resolve() }, { once: true })
      })
      setTransition({
        id,
        initiallyCovered,
        onCovered: async () => {
          covered = true
          await Promise.race([ready, budget])
          if (active !== attempt || controller.signal.aborted) return
          commit()
        },
        onComplete: () => {
          if (active !== attempt) return
          window.clearTimeout(coverTimer)
          setTransition(null)
        },
      })
    }

    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')
        || (anchor.target && anchor.target.toLowerCase() !== '_self') || anchor.relList.contains('external')) return
      const url = new URL(anchor.href)
      if (url.origin !== window.location.origin) return
      const page = getPageFromUrl(url)
      if (!page) return
      if (anchor.hasAttribute('data-site-reload')) { event.preventDefault(); reopenPage(url.href); return }
      // Only the visible project transition blocks repeat clicks, not a pending import.
      if (transitioning.current) { event.preventDefault(); return }
      if (anchor.hasAttribute('data-project-return') && Number.isInteger(window.history.state?.projectReturnDepth) && window.history.state.projectReturnDepth > 0) {
        event.preventDefault()
        persistPosition()
        window.history.go(-window.history.state.projectReturnDepth)
        return
      }
      const currentUrl = new URL(renderedHref)
      const sameDocument = url.pathname === currentUrl.pathname && url.search === currentUrl.search
      const behavior = sameDocument && url.hash.length > 1 ? 'smooth' : 'instant'
      const position = sameDocument && anchor.hasAttribute('data-preserve-scroll')
        ? { left: getPageScrollLeft(), top: getPageScrollTop() } : undefined
      event.preventDefault()
      persistPosition()
      navigate({ page, href: url.href, focus: true, behavior, position }, () => {
        if (url.href !== window.location.href) {
          const fromList = getPageFromUrl(currentUrl) === 'projects'
            && !getProjectFromUrl(currentUrl) && !isProjectStudioUrl(currentUrl)
          const returnDepth = getProjectFromUrl(url) || isProjectStudioUrl(url)
            ? (fromList ? 1 : window.history.state?.projectReturnDepth ? window.history.state.projectReturnDepth + 1 : undefined) : undefined
          currentKey = crypto.randomUUID()
          window.history.pushState({ [historyKey]: currentKey, [indexKey]: window.history.state[indexKey] + 1, projectReturnDepth: returnDepth }, '', url)
        } else currentKey = ensureKey()
      })
    }
    const pop = () => {
      const page = getPageFromUrl(new URL(window.location.href))
      if (!page) return
      const targetKey = ensureKey()
      navigate({ page, href: window.location.href, position: positions.get(targetKey) ?? savedPosition(), focus: true }, () => {
        currentKey = targetKey
      })
    }
    actions.current = {
      retry: () => active?.retry(),
      cancel: () => {
        cancelActive()
        setLoading(null)
        releaseCover()
        const delta = currentIndex - window.history.state[indexKey]
        // A failed Back/Forward already moved the history cursor. Return to the
        // retained entry without overwriting either it or the failed destination.
        if (delta) window.history.go(delta)
        else document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
      },
      renderFailed: releaseCover,
    }
    document.addEventListener('click', click)
    window.addEventListener('popstate', pop)
    window.addEventListener('scroll', savePosition, { passive: true, capture: true })
    window.addEventListener('beforeunload', persistPosition)
    window.addEventListener('pagehide', persistPosition)
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const reload = initialPage === 'projects' && entry?.type === 'reload'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden
      && (!window.__projectTransitionBoot || window.__projectTransitionBoot.status === 'active')
    navigate({ page: initialPage, href: window.location.href, position: savedPosition(), focus: false }, () => {}, reload, true)
    return () => {
      cancelActive()
      actions.current = null
      window.history.scrollRestoration = previousRestoration
      document.removeEventListener('click', click)
      window.removeEventListener('popstate', pop)
      window.removeEventListener('scroll', savePosition, true)
      window.removeEventListener('beforeunload', persistPosition)
      window.removeEventListener('pagehide', persistPosition)
    }
  }, [initialPage])

  useLayoutEffect(() => {
    transitioning.current = Boolean(transition)
    if (!transition) {
      if (navigation.focus) document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
      return
    }
    const prevent = (event: Event) => event.preventDefault()
    const preventKey = (event: KeyboardEvent) => {
      if (['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Escape'].includes(event.key)
        && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    window.addEventListener('wheel', prevent, { passive: false, capture: true })
    window.addEventListener('touchmove', prevent, { passive: false, capture: true })
    window.addEventListener('keydown', preventKey, true)
    return () => {
      window.removeEventListener('wheel', prevent, true)
      window.removeEventListener('touchmove', prevent, true)
      window.removeEventListener('keydown', preventKey, true)
    }
  }, [transition, navigation])

  useLayoutEffect(() => {
    if (!navigation.module) return
    let interacted = false
    const scroll = () => {
      if (interacted) return
      notifyNavigationScroll()
      if (navigation.position) scrollPageTo({ ...navigation.position, behavior: 'instant' })
      else if (!scrollToHashTarget({ behavior: navigation.behavior ?? 'instant' }) && navigation.focus) scrollPageTo({ top: 0, left: 0, behavior: 'instant' })
    }
    scroll()
    const frame = window.requestAnimationFrame(scroll)
    const interact = (event: Event) => {
      if (!event.defaultPrevented && !transitioning.current) interacted = true
    }
    const ready = () => { if (!interacted) scroll() }
    window.addEventListener('site-page-ready', ready)
    window.addEventListener('project-document-ready', ready)
    window.addEventListener('wheel', interact, { passive: true })
    window.addEventListener('touchstart', interact, { passive: true })
    window.addEventListener('pointerdown', interact)
    window.addEventListener('keydown', interact)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('site-page-ready', ready)
      window.removeEventListener('project-document-ready', ready)
      window.removeEventListener('wheel', interact)
      window.removeEventListener('touchstart', interact)
      window.removeEventListener('pointerdown', interact)
      window.removeEventListener('keydown', interact)
    }
  }, [navigation])

  return { ...navigation, transition, loading,
    retry: () => actions.current?.retry(), cancel: () => actions.current?.cancel(), renderFailed: () => actions.current?.renderFailed() }
}
