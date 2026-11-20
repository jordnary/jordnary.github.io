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
