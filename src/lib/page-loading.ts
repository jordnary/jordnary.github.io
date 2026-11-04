export const pageLoadTimeoutMs = 8000
export const projectCoverBudgetMs = 2500

export function reopenPage(href: string) {
  const target = new URL(href)
  if (target.pathname === window.location.pathname && target.search === window.location.search) {
    // Assigning the same URL with a fragment is only a same-document navigation.
    if (target.hash !== window.location.hash) window.location.hash = target.hash
    window.location.reload()
  } else window.location.assign(href)
}

export class PageLoadTimeoutError extends Error {
  constructor() { super('Page loading timed out'); this.name = 'PageLoadTimeoutError' }
}

/** Stop this consumer's wait, not the shared, non-cancellable dynamic import. */
export function waitForPage<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const finish = (settle: () => void) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      settle()
    }
    const abort = () => finish(() => reject(signal.reason))
    const timer = setTimeout(() => finish(() => reject(new PageLoadTimeoutError())), pageLoadTimeoutMs)
    signal.addEventListener('abort', abort, { once: true })
    // Always observe the shared import, including after cancellation or timeout.
    promise.then(value => finish(() => resolve(value)), error => finish(() => reject(error)))
    if (signal.aborted) abort()
  })
}
