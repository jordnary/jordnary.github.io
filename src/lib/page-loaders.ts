import { createElement, type ComponentType } from 'react'
import { getPageFromUrl, getProjectFromUrl, isHomepagePortalUrl, isProjectStudioUrl } from './routes'

export type PageModule = { default: ComponentType<{ href: string }> }

const imports = {
  portal: () => import('../components/HomepagePortal').then(module => ({ default: module.HomepagePortal })),
  home: () => import('../pages/HomePage').then(module => ({ default: module.HomePage })),
  about: () => import('../pages/AboutPage').then(module => ({ default: module.AboutPage })),
  learning: () => import('../pages/LearningPage').then(module => ({ default: module.LearningPage })),
  projects: () => import('../pages/ProjectsPage').then(module => ({ default: module.ProjectsPage })),
  studio: () => import('../pages/ProjectStudioPage').then(module => ({ default: module.ProjectStudioPage })),
  contact: () => import('../pages/ContactPage').then(module => ({ default: module.ContactPage })),
  detail: () => import('../pages/ProjectDetailPage').then(module => ({
    default: ({ href }: { href: string }) => createElement(module.default, { href, project: getProjectFromUrl(new URL(href))! }),
  })),
} satisfies Record<string, () => Promise<PageModule>>

// One entry per route module, including a pending import after its consumer times out.
// Clearing a Promise cannot clear the browser module map or Vite's CSS bookkeeping.
const pages = new Map<keyof typeof imports, Promise<PageModule>>()
const preloadErrors = new WeakSet<object>()

export function trackPagePreloadErrors() {
  const failed = (event: Event) => {
    const error = (event as Event & { payload: unknown }).payload
    if (error && typeof error === 'object') preloadErrors.add(error)
    // Do not preventDefault: Vite must reject before evaluating an unstyled route.
    // The import owner (or a React boundary for nested imports) handles the error.
  }
  window.addEventListener('vite:preloadError', failed)
  return () => window.removeEventListener('vite:preloadError', failed)
}

export function isPagePreloadError(error: unknown) {
  return Boolean(error && typeof error === 'object' && preloadErrors.has(error))
}

export function loadPage(url: URL): Promise<PageModule> {
  const key = isHomepagePortalUrl(url) ? 'portal' : isProjectStudioUrl(url) ? 'studio'
    : getProjectFromUrl(url) ? 'detail' : getPageFromUrl(url)
  if (!key) return Promise.reject(new Error('Unknown site route'))
  let promise = pages.get(key)
  if (!promise) {
    promise = imports[key]()
    pages.set(key, promise)
  }
  return promise
}
