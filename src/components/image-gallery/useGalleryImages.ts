import { createContext, useContext, useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { useLightboxState, type SlideImage } from 'yet-another-react-lightbox'
import { GalleryImages } from './gallery-images'
import type { GalleryTraversal } from './useThumbnailTraversal'
import { pageConnection, pageNetworkPolicy } from '../../lib/page-network'

export const GalleryImagesContext = createContext<GalleryImages | null>(null)

function subscribeVisibility(listener: () => void) {
  const connection = pageConnection()
  document.addEventListener('visibilitychange', listener)
  connection?.addEventListener?.('change', listener)
  return () => {
    document.removeEventListener('visibilitychange', listener)
    connection?.removeEventListener?.('change', listener)
  }
}

export function useGalleryImages(traversal: GalleryTraversal, stageRef: RefObject<HTMLDivElement | null>, edgePulling: boolean) {
  const images = useContext(GalleryImagesContext)!
  const revision = useSyncExternalStore(images.subscribe, images.getSnapshot)
  const canPrepare = useSyncExternalStore(subscribeVisibility, () => !document.hidden && pageNetworkPolicy().images)
  const [interacting, setInteracting] = useState(false)
  const { currentIndex, slides } = useLightboxState()
  const target = traversal?.target ?? currentIndex
  const source = (index: number) => (slides[index] as SlideImage | undefined)?.src
  const targetSource = source(target)
  const originSource = traversal ? source(traversal.origin) : undefined
  const before = source(target - 1)
  const after = source(target + 1)

  useEffect(() => {
    const events = new AbortController()
    const pointers = new Set<number>()
    document.addEventListener('pointerdown', event => {
      if (event.target instanceof Node && stageRef.current?.contains(event.target)) {
        pointers.add(event.pointerId)
        setInteracting(true)
      }
    }, { capture: true, signal: events.signal })
    const release = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (!pointers.size) setInteracting(false)
    }
    document.addEventListener('pointerup', release, { capture: true, signal: events.signal })
    document.addEventListener('pointercancel', release, { capture: true, signal: events.signal })
    return () => events.abort()
  }, [stageRef])

  useEffect(() => {
    if (!targetSource) return
    images.select(targetSource)
    const fallback = images.get(targetSource)?.status === 'ready' ? undefined : images.fallback
    const sources = traversal ? [targetSource, originSource, fallback]
      : fallback ? [targetSource, fallback] : [targetSource, after, before]
    images.retain(sources.filter((src): src is string => Boolean(src)))
    // The selected original always bypasses speculative work, including promotion.
    images.request(targetSource, true)
    if (traversal || interacting || edgePulling || images.get(targetSource)?.status !== 'ready' || !canPrepare) return
    const neighbors = [after, before].filter((src): src is string => Boolean(src))
    if (neighbors.some(src => images.get(src)?.status === 'loading')) return
    const next = neighbors.find(src => !images.get(src))
    if (!next) return
    // One speculative original at a time, only after the selection is stable.
    let timer: number
    const prepare = () => {
      if (document.hidden || !pageNetworkPolicy().images) return
      const moving = stageRef.current?.getAnimations({ subtree: true }).some(animation => animation.playState === 'running' || animation.pending)
      if (moving) timer = window.setTimeout(prepare, 120)
      else images.request(next)
    }
    timer = window.setTimeout(prepare, 120)
    return () => clearTimeout(timer)
  }, [images, targetSource, originSource, before, after, traversal, revision, canPrepare, interacting, edgePulling, stageRef])

  useEffect(() => () => images.clear(), [images])
}
