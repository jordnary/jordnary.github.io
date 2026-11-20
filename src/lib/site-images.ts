import { homeDirectory, homeNow } from '../data/home-editorial'
import { learningPhotos } from '../data/note-covers'
import { studioArtworks } from '../data/project-studio'
import { projects } from '../data/projects'
import { homeGalleryImage, learningNoteImage, learningTowerImage, nowFrameImage, nowOrnamentImage } from './inpage-images'
import { preloadImages } from './page-images'
import { projectArchiveImage, studioImage } from './page-resources'
import { projectDisplayImage } from './project-images'

/** Start once per document, after the current route renders with the real viewport. */
export function preloadSiteImages() {
  const base = import.meta.env.BASE_URL
  const images = [
    projectArchiveImage(base),
    ...[...homeDirectory, ...homeNow].map(photo => homeGalleryImage(photo.src)),
    ...Object.values(learningPhotos).map(photo => learningNoteImage(photo.file)),
    learningTowerImage('hero-tower-sketch.webp'), learningTowerImage('hero-tower-trees.webp'),
    { src: `${base}images/learning/hero-tower-outline.svg` },
    ...['crumpled-paper', 'outro-paper', 'iceberg-summit', 'iceberg-depth'].map(name => ({ src: `${base}images/about/${name}.webp` })),
    nowFrameImage(), nowOrnamentImage(),
    ...projects.flatMap(project => {
      const cover = project.image?.cover ?? project.image
      return cover ? [projectDisplayImage(`${base}images/projects/${cover.file}`, 'cover')] : []
    }),
    ...studioArtworks.map(art => studioImage(art, base)),
  ]
  preloadImages(images, 'low')
}
