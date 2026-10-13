import { notifyNavigationScroll } from './pageScrollSource'

type ScrollFocusOptions = {
  /** Preferred viewport position; omitted for touch and keyboard activation. */
  viewportY?: number
}

let cancelActive: (() => void) | undefined

/** Scroll a focusable target into view, then focus it without a second jump.
 * Only one transition runs at a time. Call the returned cleanup on unmount.
 * Targets can style data-scroll-focus="arrived" and set scroll-margin for insets.
 */
export function scrollAndFocus(target: HTMLElement, { viewportY }: ScrollFocusOptions = {}) {
  cancelActive?.()
  if (!target.isConnected) return () => {}

  let frame = 0
  let highlightTimer = 0
  let cancelled = false
  const events = new AbortController()
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const startY = window.scrollY
  const startTime = performance.now()
  notifyNavigationScroll()

  const destination = () => {
    const rect = target.getBoundingClientRect()
    const style = getComputedStyle(target)
    const topInset = Math.max(24, Number.parseFloat(style.scrollMarginTop) || 0)
    const bottomInset = Math.max(24, Number.parseFloat(style.scrollMarginBottom) || 0)
    const minY = topInset + rect.height / 2
    const maxY = Math.max(minY, window.innerHeight - bottomInset - rect.height / 2)
    const availableHeight = Math.max(0, window.innerHeight - topInset - bottomInset)
    // Keep some project context above the button even for clicks near the top.
    const readingTop = Math.max(minY, topInset + availableHeight * 0.35)
    const readingBottom = Math.max(readingTop, Math.min(maxY, topInset + availableHeight * 0.8))
    const preferredY = viewportY ?? (topInset + window.innerHeight - bottomInset) / 2
    const alignedY = Math.max(readingTop, Math.min(preferredY, readingBottom))
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    return Math.max(0, Math.min(window.scrollY + rect.top + rect.height / 2 - alignedY, maxScroll))
  }

  const cancel = () => {
    if (cancelled) return
    cancelled = true
    window.cancelAnimationFrame(frame)
    window.clearTimeout(highlightTimer)
    events.abort()
    target.removeAttribute('data-scroll-focus')
    if (cancelActive === cancel) cancelActive = undefined
  }
  cancelActive = cancel

  const finish = () => {
    if (cancelled || !target.isConnected) return cancel()
    target.focus({ preventScroll: true })
    if (cancelled) return
    target.dataset.scrollFocus = 'arrived'
    highlightTimer = window.setTimeout(cancel, 1800)
  }

  // A visitor's next action always takes priority over automatic movement.
  const options = { signal: events.signal, passive: true, capture: true }
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'resize', 'popstate', 'pagehide']) {
    window.addEventListener(type, cancel, options)
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancel()
  }, options)
  document.addEventListener('focusin', (event) => {
    if (event.target !== target) cancel()
  }, options)
  motionPreference.addEventListener('change', cancel, options)

  const distance = Math.abs(destination() - startY)
  if (motionPreference.matches || distance < 1) {
    window.scrollTo({ top: destination(), behavior: 'instant' })
    finish()
    return cancel
  }

  target.dataset.scrollFocus = 'scrolling'
  const duration = Math.min(850, 420 + distance * 0.3)
  const tick = (now: number) => {
    if (cancelled || !target.isConnected || !target.getClientRects().length) return cancel()
    const progress = Math.min(1, (now - startTime) / duration)
    // Quintic smoothstep has zero velocity and acceleration at both ends.
    const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10)
    // Remeasure while the card's entrance animation settles.
    window.scrollTo({ top: startY + (destination() - startY) * eased, behavior: 'instant' })
    if (progress < 1) frame = window.requestAnimationFrame(tick)
    else finish()
  }
  frame = window.requestAnimationFrame(tick)
  return cancel
}
