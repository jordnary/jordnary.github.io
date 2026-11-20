import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
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

export function useGalleryImages(traversal: GalleryTraversal) {
  const images = useContext(GalleryImagesContext)!
  useSyncExternalStore(images.subscribe, images.getSnapshot)
  const canPrepare = useSyncExternalStore(subscribeVisibility, () => !document.hidden && pageNetworkPolicy().images)
  const { currentIndex, slides } = useLightboxState()
  const target = traversal?.target ?? currentIndex
  const source = (index: number) => (slides[index] as SlideImage | undefined)?.src
  const selected = source(target)
  const before = source(target - 1)
  const after = source(target + 1)
  const ready = selected && images.get(selected)?.status === 'ready'

  useEffect(() => {
    if (!selected) return
    images.select(selected)
    images.request(selected, true)
  }, [images, selected])

  useEffect(() => {
    if (!ready || traversal || !canPrepare) return
    if (after) images.request(after)
    if (before) images.request(before)
  }, [images, ready, traversal, canPrepare, after, before])
}
