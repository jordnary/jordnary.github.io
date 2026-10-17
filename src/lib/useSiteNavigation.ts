import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { scrollToHashTarget } from './hashScroll'
import { notifyNavigationScroll } from './pageScrollSource'
import { getPageFromUrl, getProjectFromUrl, isProjectStudioUrl, type SitePage } from './routes'
import { shouldTransitionProjects } from './project-page-transition'
import type {} from './projectTransitionBoot'

type Position = { left: number; top: number }
type Navigation = { page: SitePage; href: string; position?: Position; focus: boolean; behavior?: ScrollBehavior }
type PageTransition = { id: number; initiallyCovered?: boolean; onCovered: () => Promise<void>; onComplete: () => void }
type PrepareNavigation = (url: URL) => Promise<unknown> | undefined
const historyKey = 'siteNavigationKey'
const positionKey = 'siteNavigationPosition'

function savedPosition(): Position | undefined {
  const value = window.history.state?.[positionKey]
  return value && Number.isFinite(value.left) && Number.isFinite(value.top) ? value : undefined
}

async function prepareWithinBudget(promise: Promise<unknown> | undefined) {
  if (!promise) return
  let timeout = 0
  try {
    await Promise.race([
      promise.catch(() => undefined),
      new Promise<void>(resolve => { timeout = window.setTimeout(resolve, 2500) }),
    ])
  } finally {
    window.clearTimeout(timeout)
  }
}

/** Keep the shared layout alive while retaining independently addressable HTML pages. */
export function useSiteNavigation(initialPage: SitePage, prepare?: PrepareNavigation) {
  const [navigation, setNavigation] = useState<Navigation>({ page: initialPage, href: window.location.href, position: savedPosition(), focus: false })
  const [transitionState, setTransition] = useState<PageTransition | 'reload' | null>(() => {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (initialPage !== 'projects' || entry?.type !== 'reload'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return null
    if (window.__projectTransitionBoot && window.__projectTransitionBoot.status !== 'active') return null
    return 'reload'
  })
  const transition = useMemo(() => {
    if (transitionState !== 'reload') return transitionState
    const url = new URL(navigation.href)
    // A reload already has its route and reading position. Animate the initial
    // render without committing history or resetting either; later navigation IDs start at 1.
    return {
      id: 0,
      initiallyCovered: true,
      onCovered: () => prepareWithinBudget(prepare?.(url)),
      onComplete: () => setTransition(current => current === 'reload' ? null : current),
    }
  }, [transitionState, navigation.href, prepare])
  const transitioning = useRef(false)

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
    let renderedHref = window.location.href
    let active: { id: number; committed: boolean } | null = null
    let revision = 0
    const savePosition = () => {
      if (!active || active.committed) positions.set(currentKey, { left: window.scrollX, top: window.scrollY })
    }
    const persistPosition = () => {
      savePosition()
      if (window.history.state?.[historyKey] === currentKey) {
        window.history.replaceState({ ...window.history.state, [positionKey]: positions.get(currentKey) }, '')
      }
    }
    savePosition()

    const navigate = (next: Navigation, commitHistory: () => void) => {
      const id = ++revision
      const commit = () => {
        commitHistory()
        renderedHref = next.href
        setNavigation(next)
      }
      const animate = shouldTransitionProjects(new URL(renderedHref), new URL(next.href))
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        && document.visibilityState !== 'hidden'
      if (!animate) {
        active = null
        setTransition(null)
        commit()
        return
      }
      active = { id, committed: false }
      // Start fetching while the old page is still visible; reveal only after the route can render.
      // A stalled chunk may use the page's existing loading state, never a locked overlay.
      const ready = prepareWithinBudget(prepare?.(new URL(next.href)))
      const onCovered = async () => {
        await ready
        if (active?.id !== id || active.committed) return
        active.committed = true
        commit()
      }
      setTransition({
        id,
        onCovered,
        onComplete: () => {
          if (active?.id !== id) return
          active = null
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
      // The overlay captures physical input; ignore synthetic repeat clicks as well.
      if (active || transitioning.current) { event.preventDefault(); return }
      if (anchor.hasAttribute('data-project-return') && Number.isInteger(window.history.state?.projectReturnDepth) && window.history.state.projectReturnDepth > 0) {
        event.preventDefault()
        persistPosition()
        window.history.go(-window.history.state.projectReturnDepth)
        return
      }
      const sameDocument = url.pathname === window.location.pathname && url.search === window.location.search
      const behavior = sameDocument && url.hash.length > 1
        ? 'smooth' : 'instant'
      // Chapter controls update the address and history without aligning the page
      // to their hash target. Direct URLs and ordinary contents links still do.
      const position = sameDocument && anchor.hasAttribute('data-preserve-scroll')
        ? { left: window.scrollX, top: window.scrollY } : undefined
      event.preventDefault()
      persistPosition()
      navigate({ page, href: url.href, focus: true, behavior, position }, () => {
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
    document.addEventListener('click', click)
    window.addEventListener('popstate', pop)
    window.addEventListener('scroll', savePosition, { passive: true })
    // Reload snapshots history before pagehide; save the last position earlier.
    window.addEventListener('beforeunload', persistPosition)
    window.addEventListener('pagehide', persistPosition)
    return () => {
      active = null
      window.history.scrollRestoration = previousRestoration
      document.removeEventListener('click', click)
      window.removeEventListener('popstate', pop)
      window.removeEventListener('scroll', savePosition)
      window.removeEventListener('beforeunload', persistPosition)
      window.removeEventListener('pagehide', persistPosition)
    }
  }, [prepare])

  useLayoutEffect(() => {
    transitioning.current = Boolean(transition)
    if (!transition) {
      if (navigation.focus) document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
      return
    }
    // Block visitor scrolling without competing with dialogs that own body overflow.
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
    const interact = (event: Event) => {
      if (!event.defaultPrevented && !transitioning.current) interacted = true
    }
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

  return { ...navigation, transition }
}
