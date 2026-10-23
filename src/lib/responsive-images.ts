import manifest from '../generated/responsive-images.json'

type ImageEntry = { width: number; height: number; variants: { width: number; file: string }[] }
const images: Record<string, ImageEntry> = manifest
const base = import.meta.env.BASE_URL

function imageEntry(src: string) {
  return src.startsWith(base) ? images[src.slice(base.length)] : undefined
}

/** Sizes describe the rendered artwork, including its hover/scroll scale. */
export function responsiveImage(src: string, sizes: string) {
  const entry = imageEntry(src)
  if (!entry) return {}
  return {
    srcSet: [...entry.variants.map(image => `${base}${image.file} ${image.width}w`), `${src} ${entry.width}w`].join(', '),
    sizes,
  }
}

export function imageThumbnail(src: string) {
  const thumbnail = imageEntry(src)?.variants[0]
  return thumbnail ? `${base}${thumbnail.file}` : src
}
