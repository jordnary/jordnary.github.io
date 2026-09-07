const completionEvent = 'site:companion-complete'

/** Call after an operation succeeds, never just because its button was clicked. */
export function notifyCompanionComplete(message: string) {
  window.dispatchEvent(new CustomEvent(completionEvent, { detail: message }))
}

export function onCompanionComplete(callback: (message: string) => void) {
  const listener = (event: Event) => {
    const detail: unknown = (event as CustomEvent).detail
    if (typeof detail === 'string' && detail.trim()) callback(detail.trim().slice(0, 100))
  }
  window.addEventListener(completionEvent, listener)
  return () => window.removeEventListener(completionEvent, listener)
}
