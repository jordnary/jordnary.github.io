import manifest from '../generated/responsive-images.json'

type ImageEntry = { width: number; height: number; variants: { width: number; file: string }[] }
const images: Record<string, ImageEntry> = manifest
function imageEntry(src: string, base = import.meta.env.BASE_URL) {
  return src.startsWith(base) ? images[src.slice(base.length)] : undefined
}

/** Sizes describe the rendered artwork, including its hover/scroll scale. */
export function responsiveImage(src: string, sizes: string, base = import.meta.env.BASE_URL) {
  const entry = imageEntry(src, base)
  if (!entry) return {}
  return {
    srcSet: [...entry.variants.map(image => `${base}${image.file} ${image.width}w`), `${src} ${entry.width}w`].join(', '),
    sizes,
  }
}

export function imageThumbnail(src: string) {
  const thumbnail = imageEntry(src)?.variants[0]
  return thumbnail ? `${import.meta.env.BASE_URL}${thumbnail.file}` : src
}

export function imageDimensions(src: string) {
  const entry = imageEntry(src)
  return entry ? { width: entry.width, height: entry.height } : undefined
}
