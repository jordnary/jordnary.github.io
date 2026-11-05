import { getPageResources, type PageImage } from './page-resources'

type ImageTask = { promise: Promise<void>; image: HTMLImageElement | null }
// Only the finite, declared critical images are tracked. Decoded objects are released.
const images = new Map<string, ImageTask>()

function prepareImage(source: PageImage, priority: 'high' | 'low') {
  const key = JSON.stringify(source)
  const existing = images.get(key)
  if (existing) {
    if (priority === 'high' && existing.image) existing.image.fetchPriority = 'high'
    return existing.promise
  }
  const image = new Image()
  image.fetchPriority = priority
  image.decoding = 'async'
  if (source.sizes) image.sizes = source.sizes
  if (source.srcSet) image.srcset = source.srcSet
  image.src = source.src
  const task: ImageTask = { image, promise: Promise.resolve() }
  task.promise = image.decode().catch(() => {
    // A failed hint is optional. Allow a later intent/click to try the real source again.
    images.delete(key)
  }).finally(() => { task.image = null })
  images.set(key, task)
  return task.promise
}

export function preparePageImages(url: URL, priority: 'high' | 'low') {
  const sources = getPageResources(url, import.meta.env.BASE_URL)?.images ?? []
  return Promise.all(sources.map(source => prepareImage(source, priority)))
}
