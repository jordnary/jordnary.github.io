import { createElement, type ComponentType } from 'react'
import { getProjectFromUrl } from './routes'
import { getPageResources, type PageModuleKey } from './page-resources'
import { preparePageImages } from './page-images'
import { pageNetworkPolicy } from './page-network'

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
} satisfies Record<PageModuleKey, () => Promise<PageModule>>

// One entry per route module, including a pending import after its consumer times out.
// Clearing a Promise cannot clear the browser module map or Vite's CSS bookkeeping.
const pages = new Map<PageModuleKey, { promise: Promise<PageModule>; failed: boolean }>()
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

export function hasFailedPage(url: URL) {
  const key = getPageResources(url, import.meta.env.BASE_URL)?.key
  const task = key ? pages.get(key) : undefined
  return Boolean(task?.failed)
}

export function loadPage(url: URL, intent = false): Promise<PageModule> {
  const key = getPageResources(url, import.meta.env.BASE_URL)?.key
  if (!key) return Promise.reject(new Error('Unknown site route'))
  // Discover images alongside code without letting a large bitmap delay the shell.
  if (!intent && pageNetworkPolicy().images) void preparePageImages(url, 'low')
  let task = pages.get(key)
  if (!task) {
    const entry = { promise: imports[key](), failed: false }
    task = entry
    pages.set(key, entry)
    void entry.promise.catch(() => { entry.failed = true })
  }
  if (!intent) void task.promise.then(() => preparePageImages(url, 'high'), () => {})
  return task.promise
}
