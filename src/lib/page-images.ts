import type { PageImage } from './page-resources'

type Priority = 'high' | 'auto' | 'low'
export function preloadImage(source: PageImage, priority: Priority) {
  const image = new Image()
  image.fetchPriority = priority
  image.decoding = 'async'
  if (source.sizes) image.sizes = source.sizes
  if (source.srcSet) image.srcset = source.srcSet
  image.src = source.src
  return image
}

export function preloadImages(sources: PageImage[], priority: Priority) {
  for (const source of sources) preloadImage(source, priority)
}

type ImageTask = {
  promise: Promise<{ width: number; height: number }>
  promote: () => void
}

// Only share outstanding requests. The browser owns completed image data.
const pending = new Map<string, ImageTask>()

export function prepareImage(source: PageImage, priority: Priority, timeoutMs?: number): ImageTask {
  const key = JSON.stringify([source.src, source.srcSet, source.sizes, timeoutMs])
  const existing = pending.get(key)
  if (existing) {
    if (priority === 'high') existing.promote()
    return existing
  }

  const image = preloadImage(source, priority)

  let timer: number | undefined
  let decoded = image.decode()
  if (timeoutMs) {
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error('Image preparation timed out'))
        image.removeAttribute('srcset')
        image.removeAttribute('src')
      }, timeoutMs)
    })
    decoded = Promise.race([decoded, timeout])
  }
  const promise = decoded
    .then(() => ({ width: image.naturalWidth, height: image.naturalHeight }))
    .finally(() => {
      clearTimeout(timer)
      pending.delete(key)
    })
  const task = { promise, promote: () => { image.fetchPriority = 'high' } }
  pending.set(key, task)
  return task
}
