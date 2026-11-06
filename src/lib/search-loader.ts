import moduleUrl from 'virtual:site-search-url'
import styleUrl from '../components/SiteSearchResults.css?url'

type SearchModule = typeof import('../components/SiteSearchResults')
let ready: SearchModule | undefined
let moduleTask: Promise<SearchModule> | undefined
let styleTask: Promise<void> | undefined
let pending: Promise<SearchModule> | undefined
let attempt = 0

export const preparedSearch = () => ready

function loadStyle() {
  if (!styleTask) styleTask = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = styleUrl
    link.dataset.searchStyle = ''
    link.onload = () => { link.onload = link.onerror = null; resolve() }
    link.onerror = () => {
      link.remove()
      styleTask = undefined
      reject(new Error('Search stylesheet failed to load'))
    }
    document.head.append(link)
  })
  return styleTask
}

/** Intent and required opens share one task. Closing only cancels the consumer. */
export function prepareSearch(): Promise<SearchModule> {
  if (ready) return Promise.resolve(ready)
  if (pending) return pending
  if (!moduleTask) {
    const url = new URL(moduleUrl, window.location.href)
    // A failed module URL can remain in the browser module map. Retry only the
    // failed feature root; JSX runtime and routing metadata are already loaded.
    if (attempt) url.searchParams.set('search-retry', String(attempt))
    moduleTask = import(/* @vite-ignore */ url.href).then(module => {
      if (typeof module.SearchResults !== 'function' || typeof module.searchSite !== 'function') throw new Error('Invalid search module')
      return module as SearchModule
    }).catch((error: unknown) => {
      moduleTask = undefined
      attempt++
      throw error
    })
  }
  const task = Promise.all([moduleTask!, loadStyle()]).then(([module]) => {
    ready = module
    return module
  })
  pending = task
  void task.then(() => { pending = undefined }, () => { pending = undefined })
  return task
}

const recoveryKey = 'site-search-recovery'
export function searchRecovery(): { query: string } | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(recoveryKey) ?? 'null')
    if (value?.href === location.href && typeof value.query === 'string'
      && Number.isFinite(value.time) && Date.now() - value.time < 60000) return value
  } catch { /* Storage may be unavailable; in-place retries remain available. */ }
}
export function clearSearchRecovery() {
  try { sessionStorage.removeItem(recoveryKey) } catch { /* Optional recovery state. */ }
}
export function reloadSearch(query: string) {
  // A new document discovers replacement hashes after a deployment. Do not
  // discard typed text when storage is blocked or full.
  sessionStorage.setItem(recoveryKey, JSON.stringify({ href: location.href, query, time: Date.now() }))
  location.reload()
}
