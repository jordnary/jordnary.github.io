import { studioArtworks } from '../data/project-studio'
import { getPageFromUrl, getProjectFromUrl, isHomepagePortalUrl, isProjectStudioUrl } from './routes'
import { responsiveImage } from './responsive-images'
import { projectDisplayImage } from './project-images'

/** Shared by HTML generation, navigation and the displayed image elements. */
export type PageImage = { src: string; srcSet?: string; sizes?: string }
export const pageModuleFiles = {
  portal: 'src/components/HomepagePortal.tsx',
  home: 'src/pages/HomePage.tsx',
  about: 'src/pages/AboutPage.tsx',
  learning: 'src/pages/LearningPage.tsx',
  projects: 'src/pages/ProjectsPage.tsx',
  studio: 'src/pages/ProjectStudioPage.tsx',
  contact: 'src/pages/ContactPage.tsx',
  detail: 'src/pages/ProjectDetailPage.tsx',
} as const
export type PageModuleKey = keyof typeof pageModuleFiles

export function learningCoverImages(base: string): PageImage[] {
  return ['hero-campus-sketch.webp', 'hero-campus-trees.webp'].map(file => {
    const src = `${base}images/learning/${file}`
    return { src, ...responsiveImage(src, '(max-width: 768px) 112vw, 90vw', base) }
  })
}

export function projectArchiveImage(base: string): PageImage {
  const src = `${base}images/project-archive/linework-background-1920.webp`
  return { src, srcSet: `${src} 1920w, ${base}images/project-archive/linework-background-3840.webp 3840w`,
    sizes: '(min-aspect-ratio: 1672/941) 100vw, 177.7lvh' }
}

export function studioImage(artwork: typeof studioArtworks[number], base: string): PageImage {
  const src = `${base}images/project-studio/${artwork.file}`
  return { src, ...responsiveImage(src,
    `(max-width: 700px) ${34 * artwork.width / artwork.height}svh, ${36.1 * artwork.width / artwork.height}svh`, base) }
}

export const aboutCoverImage = (base: string): PageImage => ({ src: `${base}images/about/fiber-paper.webp` })
export function contactCoverImage(base: string): PageImage {
  const artwork = `${base}images/contact/street-graffiti-cycle`
  return {
    src: `${artwork}.webp`,
    srcSet: `${artwork}-768.webp 768w, ${artwork}-1536.webp 1536w, ${artwork}.webp 3072w`,
    sizes: '100vw',
  }
}

export function getPageResources(url: URL, base: string) {
  const project = getProjectFromUrl(url, base)
  const key: PageModuleKey | null = isHomepagePortalUrl(url, base) ? 'portal'
    : isProjectStudioUrl(url, base) ? 'studio' : project ? 'detail' : getPageFromUrl(url, base)
  if (!key) return null
  const cover = project?.image?.cover ?? project?.image
  const images: PageImage[] = key === 'learning' ? learningCoverImages(base)
    : key === 'projects' ? [projectArchiveImage(base)]
    : key === 'studio' ? [studioImage(studioArtworks[0], base)]
    : key === 'detail' && cover ? [projectDisplayImage(`${base}images/projects/${cover.file}`, 'cover', base)]
    : key === 'about' ? [aboutCoverImage(base)]
    : key === 'contact' ? [contactCoverImage(base)] : []
  // Large archive/studio artwork starts at entry execution: parser-time requests
  // delayed route code on constrained links, and svh needs an initialized viewport.
  const htmlImages = key === 'projects' || key === 'studio' ? [] : images
  return { key, id: project ? `detail:${project.id}` : key, images, htmlImages }
}
