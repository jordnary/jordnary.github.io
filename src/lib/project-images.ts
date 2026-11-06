import { responsiveImage } from './responsive-images'

// Conservative CSS widths follow the reader/menu gutters and archive preview.
// Original URLs remain available to the gallery and high-density displays.
const sizes = {
  cover: '(max-width: 480px) calc(94vw - 68px), (max-width: 800px) min(460px, 84vw), (max-width: 1200px) 40vw, 480px',
  figure: '(max-width: 480px) calc(94vw - 76px), (max-width: 800px) calc(94vw - 216px), (max-width: 1200px) calc(85vw - 140px), 920px',
  preview: '(max-width: 1000px) 36vw, 30.3vw',
}

export function projectDisplayImage(src: string, kind: keyof typeof sizes, base = import.meta.env.BASE_URL) {
  return { src, ...responsiveImage(src, sizes[kind], base) }
}
