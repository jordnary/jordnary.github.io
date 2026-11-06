declare global {
  interface Window {
    __sitePageFailure?: { dispose: () => void; update: (onDismiss?: () => void) => void }
  }
}

/** Self-contained so the entry guard can inline it before React or CSS loads. */
export function showPageLoadFailure(onDismiss?: () => void) {
  const existing = window.__sitePageFailure
  if (existing) {
    existing.update(onDismiss)
    return existing.dispose
  }

  const panel = document.createElement('button')
  panel.type = 'button'
  panel.className = 'page-load-feedback'
  panel.dataset.state = 'error'
  panel.lang = 'zh-CN'
  panel.setAttribute('aria-label', '关闭页面加载失败提示')
  const message = document.createElement('span')
  message.setAttribute('role', 'alert')
  message.textContent = '页面加载失败'
  const countdown = document.createElement('span')
  countdown.className = 'page-load-feedback-countdown'
  countdown.setAttribute('aria-hidden', 'true')
  panel.append(message, countdown)

  const previousFocus = document.activeElement
  let dismissed = false
  let disposed = false
  let exitTimer = 0
  let callback = onDismiss
  const dispose = () => {
    if (disposed) return
    disposed = true
    window.clearTimeout(timer)
    window.clearTimeout(exitTimer)
    const focused = document.activeElement === panel
    panel.remove()
    if (window.__sitePageFailure === notice) delete window.__sitePageFailure
    if (focused) {
      const target = previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.closest('[inert]')
        ? previousFocus : document.querySelector<HTMLElement>('main')
      target?.focus({ preventScroll: true })
    }
  }
  const finish = () => {
    if (disposed) return
    dispose()
    callback?.()
  }
  const motionAllowed = () => !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const leave = () => {
    if (disposed || panel.dataset.state === 'closing') return
    window.clearTimeout(exitTimer)
    panel.dataset.state = 'closing'
    if (!motionAllowed()) finish()
    else {
      // Also finish when animations are disabled or interrupted by user styles.
      exitTimer = window.setTimeout(finish, 240)
    }
  }
  const dismiss = (manual = false) => {
    if (dismissed || disposed) return
    dismissed = true
    window.clearTimeout(timer)
    if (manual && motionAllowed()) {
      panel.dataset.state = 'pressing'
      exitTimer = window.setTimeout(leave, 280)
    } else leave()
  }
  const notice = { dispose, update: (next?: () => void) => { callback = next } }
  window.__sitePageFailure = notice
  panel.addEventListener('click', () => dismiss(true))
  panel.addEventListener('animationend', event => {
    if (event.target !== panel || !dismissed) return
    if (event.animationName === 'page-load-press') leave()
    if (event.animationName === 'page-load-leave') finish()
  })
  document.documentElement.append(panel)
  const timer = window.setTimeout(() => dismiss(), 5000)
  return dispose
}
