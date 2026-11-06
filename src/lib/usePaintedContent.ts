import { useEffect, useState } from 'react'

/** Preserve modal opening animation frames; route loads never wait on this. */
function paintOpeningSurface(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    let frame = 0
    const finish = () => {
      window.cancelAnimationFrame(frame)
      signal.removeEventListener('abort', finish)
      document.removeEventListener('visibilitychange', visibility)
      resolve()
    }
    const visibility = () => { if (document.hidden) finish() }
    signal.addEventListener('abort', finish, { once: true })
    document.addEventListener('visibilitychange', visibility)
    if (signal.aborted || document.hidden) finish()
    else frame = window.requestAnimationFrame(() => { frame = window.requestAnimationFrame(finish) })
  })
}

/** Construct heavier content after its existing opening surface has painted. */
export function usePaintedContent(active = true) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!active || ready) return
    const controller = new AbortController()
    let frame = 0
    void paintOpeningSurface(controller.signal).then(() => {
      // An opacity transition starts at zero. Let its first visible frame paint
      // before React constructs content in the following animation frame.
      if (!controller.signal.aborted) frame = requestAnimationFrame(() => setReady(true))
    })
    return () => { controller.abort(); cancelAnimationFrame(frame) }
  }, [active, ready])
  return ready
}
