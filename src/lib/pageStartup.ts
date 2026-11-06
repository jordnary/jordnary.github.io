import type {} from './projectTransitionBoot'
import type { showPageLoadFailure } from './page-load-notice'

declare global {
  interface Window {
    __siteStartup?: { failed: boolean; dispose: () => void }
  }
}

/** Inlined ahead of entry assets by Vite; no imports or React required to recover. */
export function bootstrapPageStartup(notify: typeof showPageLoadFailure) {
  let clearNotice: (() => void) | undefined
  const fail = () => {
    if (startup.failed) return
    startup.failed = true
    window.clearTimeout(timer)
    clearNotice = notify()
    window.__projectTransitionBoot?.dispose('skipped')
  }
  const error = (event: Event) => {
    if ((event.target instanceof HTMLScriptElement && event.target.type === 'module')
      || (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet')) fail()
  }
  const timer = window.setTimeout(fail, 8000)
  const startup: NonNullable<Window['__siteStartup']> = window.__siteStartup = {
    failed: false,
    dispose: () => {
      window.clearTimeout(timer)
      window.removeEventListener('error', error, true)
      clearNotice?.()
    },
  }
  window.addEventListener('error', error, true)
}
