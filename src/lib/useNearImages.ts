import { useEffect, useState, type RefObject } from 'react'
import { pageConnection, pageNetworkPolicy } from './page-network'
import { getMobilePageScroller } from './pageScrollSource'

/** Bound vertical discovery independently of the browser's native lazy radius. */
export function useNearImages(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || near) return
    let observer: IntersectionObserver | undefined
    const connection = pageConnection()
    const observe = () => {
      observer?.disconnect()
      if (document.hidden) return
      observer = new IntersectionObserver(entries => {
        if (!document.hidden && entries.some(entry => entry.isIntersecting)) {
          setNear(true)
          observer?.disconnect()
        }
      }, { root: getMobilePageScroller(),
        rootMargin: connection?.saveData ? '0px' : pageNetworkPolicy().images ? '2100px 0px' : '1400px 0px' })
      observer.observe(element)
    }
    // Focus/fast positioning is required work even under save-data.
    const activate = () => setNear(true)
    observe()
    element.addEventListener('focusin', activate)
    document.addEventListener('visibilitychange', observe)
    connection?.addEventListener('change', observe)
    return () => {
      observer?.disconnect()
      element.removeEventListener('focusin', activate)
      document.removeEventListener('visibilitychange', observe)
      connection?.removeEventListener('change', observe)
    }
  }, [ref, near])
  return near
}
