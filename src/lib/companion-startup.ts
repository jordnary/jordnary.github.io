/** The route has committed. Yield once, without waiting on a possibly throttled
 * animation frame before the idle timeout can even start. */
export function scheduleCompanionStart(start: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const idle = window.requestIdleCallback(start, { timeout: 1000 })
    return () => window.cancelIdleCallback(idle)
  }
  const timer = window.setTimeout(start, 32)
  return () => window.clearTimeout(timer)
}
