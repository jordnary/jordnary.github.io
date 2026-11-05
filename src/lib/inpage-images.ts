import { navigationPhotos, type NavigationPhoto } from '../data/navigation-photos'
import { responsiveImage } from './responsive-images'
import type { PageImage } from './page-resources'

export const homeGalleryImage = (src: string): PageImage => ({
  src, ...responsiveImage(src, '(max-width: 600px) 84vw, (max-width: 900px) 63vw, 42vw'),
})

export function navigationImage(photo: NavigationPhoto, mobile = false): PageImage {
  const src = `${import.meta.env.BASE_URL}images/navigation/${navigationPhotos[photo].file}-1920.webp`
  // Include the small hover zoom, with the same description at prepare/display.
  // The mobile landscape photo is cropped into a square: its 8:5 source needs
  // 1.6 times the frame width to retain the same pixel density.
  const sizes = mobile ? (photo === 'landscape' ? '188px' : '92px')
    : photo === 'landscape' ? '(max-width: 1023px) calc(52.25vw - 36px), (min-width: 1200px) 390px, 32vw'
      : '(max-width: 1023px) calc(35vw - 30px), (min-width: 1200px) 272px, 23vw'
  return { src, ...responsiveImage(src, sizes) }
}

export function nowFrameImage(): PageImage {
  const src = `${import.meta.env.BASE_URL}images/home/now-woodland-frame.webp`
  return { src, ...responsiveImage(src,
    'min(1120px, calc(100vw - clamp(32px, 8vw, 96px)), calc(150dvh - clamp(48px, 12dvh, 144px)))') }
}

export function nowOrnamentImage(): PageImage {
  const src = `${import.meta.env.BASE_URL}images/home/repository-flourish.webp`
  return { src, ...responsiveImage(src, '260px') }
}
