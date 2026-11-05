import { useEffect, useState } from 'react'
import { paintPageFeedback } from './page-loading'

/** Construct heavier content after its existing opening surface has painted. */
export function usePaintedContent(active = true) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!active || ready) return
    const controller = new AbortController()
    let frame = 0
    void paintPageFeedback(controller.signal).then(() => {
      // An opacity transition starts at zero. Let its first visible frame paint
      // before React constructs content in the following animation frame.
      if (!controller.signal.aborted) frame = requestAnimationFrame(() => setReady(true))
    })
    return () => { controller.abort(); cancelAnimationFrame(frame) }
  }, [active, ready])
  return ready
}
