import { getPageResources, type PageImage } from './page-resources'

type Priority = 'high' | 'auto' | 'low'
type ImageResult = { width: number; height: number }
type ImageTask = {
  promise: Promise<ImageResult>
  image: HTMLImageElement | null
  consumers: number
  cancel: () => void
}
// Share in-flight work across pages and local viewers. Keep only bounded metadata
// after decode; the browser owns response caching and decoded bitmap eviction.
const images = new Map<string, ImageTask>()
const MAX_PREPARED_IMAGES = 48
function trimImages() {
  for (const [key, task] of images) {
    if (images.size <= MAX_PREPARED_IMAGES) break
    if (!task.image && !task.consumers) images.delete(key)
  }
}

export function prepareImage(source: PageImage, priority: Priority = 'low') {
  // A resized viewport/DPR can select a different responsive candidate.
  const key = JSON.stringify([source.src, source.srcSet, source.sizes,
    source.srcSet ? [innerWidth, innerHeight, devicePixelRatio] : null])
  let task = images.get(key)
  if (!task) {
    const image = new Image()
    image.fetchPriority = priority
    image.decoding = 'async'
    let cancel = () => {}
    const promise = new Promise<ImageResult>((resolve, reject) => {
      let settled = false
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        image.onload = image.onerror = null
        if (error) {
          images.delete(key)
          image.removeAttribute('src')
          image.removeAttribute('srcset')
          reject(error)
        } else resolve({ width: image.naturalWidth, height: image.naturalHeight })
      }
      const timer = window.setTimeout(() => finish(new Error('Image preparation timed out')), 8000)
      cancel = () => finish(new Error('Image preparation released'))
      image.onerror = () => finish(new Error('Image preparation failed'))
      image.onload = () => { void image.decode().then(() => finish(), () => finish(new Error('Image decode failed'))) }
      // Set the candidate description before src, matching the displayed image.
      if (source.sizes) image.sizes = source.sizes
      if (source.srcSet) image.srcset = source.srcSet
      image.src = source.src
    })
    task = { image, consumers: 0, cancel, promise }
    const created = task
    const settled = () => { created.image = null; created.cancel = () => {}; trimImages() }
    void promise.then(settled, settled)
    images.set(key, task)
  }
  const owned = task
  owned.consumers++
  const promote = () => { if (owned.image) owned.image.fetchPriority = 'high' }
  if (priority === 'high') promote()
  let released = false
  return { promise: owned.promise, promote, release() {
    if (released) return
    released = true
    if (--owned.consumers === 0 && owned.image) owned.cancel()
    trimImages()
  } }
}

/** Required callers decide when to start; speculative callers own their gate. */
export function prepareImages(sources: PageImage[], priority: Priority) {
  const tasks = sources.map(source => prepareImage(source, priority))
  return {
    promise: Promise.allSettled(tasks.map(task => task.promise)).finally(() => tasks.forEach(task => task.release())),
    release: () => tasks.forEach(task => task.release()),
  }
}

export function preparePageImages(url: URL, priority: 'high' | 'low') {
  const sources = getPageResources(url, import.meta.env.BASE_URL)?.images ?? []
  return prepareImages(sources, priority).promise
}
